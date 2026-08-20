'use strict';
'require view';
'require rpc';

var callGetConfigCompare = rpc.declare({
	object: 'luci.frps-advanced',
	method: 'get_config_compare',
	expect: { '': {} },
	reject: true
});

function unavailableState(message) {
	return {
		ok: false,
		service_running: false,
		candidate: { ok: false, exists: false, content: '', message: message || '' },
		runtime: { exists: false, content: '', path: '/var/etc/frps-advanced/frps.main.toml', message: message || '' },
		equal: null
	};
}

/* ---- LCS diff (pure JS, no deps) ---- */
function computeDiff(leftText, rightText) {
	var Lorig = leftText  ? leftText.split('\n')  : [];
	var Rorig = rightText ? rightText.split('\n') : [];
	var L = Lorig;
	var R = Rorig;

	var m = L.length, n = R.length, i, j;
	var dp = [];
	for (i = 0; i <= m; i++) { dp[i] = []; for (j = 0; j <= n; j++) dp[i][j] = 0; }
	for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
		dp[i][j] = L[i-1] === R[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

	var raw = []; i = m; j = n;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && L[i-1] === R[j-1]) {
			raw.unshift({ t: 'same', l: Lorig[i-1], r: Rorig[j-1], ln: i, rn: j }); i--; j--;
		} else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
			raw.unshift({ t: 'add',  l: null, r: Rorig[j-1], ln: null, rn: j }); j--;
		} else {
			raw.unshift({ t: 'del',  l: Lorig[i-1], r: null, ln: i, rn: null }); i--;
		}
	}

	/* batch consecutive del+add blocks, pair by position */
	var merged = [], k = 0;
	while (k < raw.length) {
		if (raw[k].t === 'del') {
			var dels = [];
			while (k < raw.length && raw[k].t === 'del') { dels.push(raw[k]); k++; }
			var adds = [];
			while (k < raw.length && raw[k].t === 'add') { adds.push(raw[k]); k++; }
			var pc = Math.min(dels.length, adds.length);
			for (var p = 0; p < pc; p++)
				merged.push({ t: 'mod', l: dels[p].l, r: adds[p].r, ln: dels[p].ln, rn: adds[p].rn });
			for (var p = pc; p < dels.length; p++)
				merged.push({ t: 'del', l: dels[p].l, r: null, ln: dels[p].ln, rn: null });
			for (var p = pc; p < adds.length; p++)
				merged.push({ t: 'add', l: null, r: adds[p].r, ln: null, rn: adds[p].rn });
		} else { merged.push(raw[k]); k++; }
	}
	return merged;
}

var LS = 'display:flex;align-items:stretch;min-height:22px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;font-size:13px;line-height:1.55;';
var NS = 'flex-shrink:0;width:44px;padding:0 8px 0 4px;text-align:right;color:#94a3b8;user-select:none;border-right:1px solid #e2e8f0;margin-right:8px;';
var TS = 'flex:1;white-space:pre;overflow:hidden;padding-right:8px;';
var TOML_DIFF_ONLY_KEY = 'frps-advanced-toml-diff-only';

function buildLine(text, num, cls) {
	return E('div', { class: 'frps-diff-line ' + (cls||''), style: LS }, [
		E('span', { style: NS }, num != null ? String(num) : ''),
		E('span', { style: TS }, text != null ? text : '')
	]);
}
return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
	load() {
		return L.resolveDefault(callGetConfigCompare(), unavailableState(_('Unable to load TOML comparison data.')));
	},

	render(initialState) {
		var storedDiffOnly = localStorage.getItem(TOML_DIFF_ONLY_KEY);
		var showDiffOnly = storedDiffOnly === 'true', diffData = null, syncing = false;

		var candidateStatus = E('div', { style: 'margin:6px 0 8px;padding:0;font-size:.84rem;line-height:1.45;' });
		var runtimeStatus   = E('div', { style: 'margin:6px 0 8px;padding:0;font-size:.84rem;line-height:1.45;' });
		var runtimeTitle    = E('h3', { style: 'margin:0;padding:0;font-size:1rem;' }, _('Current Runtime Configuration'));
		var runtimePath     = E('code', {}, '/var/etc/frps-advanced/frps.main.toml');

		var candidateContainer = E('div', {
			style: 'width:100%;height:520px;min-height:360px;overflow:auto;box-sizing:border-box;border-radius:8px;border:1px solid #d1d5db;background:#fff;'
		});
		var runtimeContainer = E('div', {
			style: 'width:100%;height:520px;min-height:360px;overflow:auto;box-sizing:border-box;border-radius:8px;border:1px solid #d1d5db;background:#fff;'
		});

		candidateContainer.addEventListener('scroll', function() {
			if (syncing) return; syncing = true;
			runtimeContainer.scrollTop = candidateContainer.scrollTop;
			syncing = false;
		});
		runtimeContainer.addEventListener('scroll', function() {
			if (syncing) return; syncing = true;
			candidateContainer.scrollTop = runtimeContainer.scrollTop;
			syncing = false;
		});

		var toggleBtn = E('button', {
			class: 'cbi-button frps-diff-toggle',
			style: 'min-width:132px;height:34px;padding:6px 16px;font-size:13px;font-weight:600;border-radius:6px;border:1px solid rgba(91,115,232,.55);background:rgba(91,115,232,.1);color:#4f6fe8;cursor:pointer;',
			click: function() {
				showDiffOnly = !showDiffOnly;
				localStorage.setItem(TOML_DIFF_ONLY_KEY, showDiffOnly ? 'true' : 'false');
				applyToggleStyle();
				if (diffData) renderDiff(diffData);
			}
		}, '');
		function applyToggleStyle() {
			toggleBtn.textContent = showDiffOnly ? _('Show full configuration') : _('Show differences only');
			toggleBtn.style.background    = showDiffOnly ? '#5b73e8'                  : 'rgba(91,115,232,.1)';
			toggleBtn.style.color         = showDiffOnly ? '#fff'                     : '#4f6fe8';
			toggleBtn.style.borderColor   = showDiffOnly ? '#5b73e8'                  : 'rgba(91,115,232,.55)';
		}

		function setStatus(node, message, isError) {
			node.textContent = message || '';
			node.style.color = isError ? '#b91c1c' : '#475569';
		}

		function renderDiff(diff) {
			candidateContainer.innerHTML = '';
			runtimeContainer.innerHTML = '';
			if (!diff || diff.length === 0) { candidateContainer.textContent = _('No data.'); runtimeContainer.textContent = _('No data.'); return; }

			for (var i = 0; i < diff.length; i++) {
				var d = diff[i];
				var isChg = (d.t !== 'same');
				if (showDiffOnly && !isChg) continue;
				var lc = d.t === 'del' ? 'frps-diff-removed' : d.t === 'mod' ? 'frps-diff-modified' : (showDiffOnly && d.t === 'add' ? 'frps-diff-hidden' : '');
				var rc = d.t === 'add' ? 'frps-diff-added'   : d.t === 'mod' ? 'frps-diff-modified' : (showDiffOnly && d.t === 'del' ? 'frps-diff-hidden' : '');
				candidateContainer.appendChild(buildLine(d.l, d.ln, lc));
				runtimeContainer.appendChild(buildLine(d.r, d.rn, rc));
			}
		}

		function applyState(state) {
			state = state && typeof state === 'object' ? state : unavailableState(_('Unable to load TOML comparison data.'));
			var candidate = state.candidate || {}, runtime = state.runtime || {};

			if (candidate.ok === true)
				setStatus(candidateStatus, _('Generated from the saved UCI configuration. Candidate config; verified on Save & Apply.'), false);
			else if (candidate.code === 'EMPTY')
				setStatus(candidateStatus, _('Candidate generation failed.') + ': ' + _('Candidate configuration is empty.'), true);
			else
				setStatus(candidateStatus, _('Candidate generation failed.') + (candidate.message ? ': ' + candidate.message : ''), true);

			var svcRun = state.service_running === true;
			runtimeTitle.textContent = svcRun ? _('Current Runtime Configuration') : _('Last Generated Runtime Configuration');
			runtimePath.textContent = runtime.path || '/var/etc/frps-advanced/frps.main.toml';

			var runtimeMsg;
			if (runtime.exists) {
				runtimeMsg = _('Runtime configuration is available.');
			} else {
				var reasons = {
					'runtime configuration file not found': _('Runtime configuration file not found'),
					'runtime configuration exceeds 512 KiB': _('Runtime configuration file is too large'),
					'runtime configuration file is empty': _('Runtime configuration file is empty'),
					'unable to read runtime configuration': _('Unable to read runtime configuration')
				};
				runtimeMsg = reasons[runtime.message] || _('Runtime configuration is unavailable.');
			}
			setStatus(runtimeStatus,
				_('Service status') + '：' + (svcRun ? _('Running') : _('Stopped')) + '，' + runtimeMsg,
				!runtime.exists);

			var leftText  = (candidate.exists && typeof candidate.content === 'string') ? candidate.content : '';
			var rightText = (runtime.exists && typeof runtime.content === 'string') ? runtime.content : '';

			diffData = computeDiff(leftText, rightText);
			applyToggleStyle();
			renderDiff(diffData);
		}
		var toolbar = E('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;width:calc(100% - 16px);max-width:1250px;box-sizing:border-box;gap:12px;margin:0 0 12px 8px;padding:0 12px;' }, [
			E('p', { class: 'cbi-map-descr', style: 'min-width:0;margin:0;padding:0;' },
				E('strong', {}, _('This page is read-only and will not modify the configuration or reload FRPS.'))),
			E('div', { style: 'justify-self:center;' }, toggleBtn),
			E('div', { style: 'justify-self:end;' })
		]);

		applyState(initialState);

		return E('div', { class: 'cbi-map' }, [
			E('style', {},
				'@media(max-width:1000px){.frps-toml-compare-grid{grid-template-columns:1fr!important}}' +
				'.frps-diff-removed  { background: #fee2e2; }' +
				'.frps-diff-added    { background: #dcfce7; }' +
				'.frps-diff-modified { background: #fef9c3; }' +
				'.frps-diff-hidden   { visibility: hidden; }' +
				'.frps-diff-toggle:hover { box-shadow:0 0 0 2px rgba(91,115,232,.25); }'),
			E('div', { class: 'cbi-section' }, [
				E('p', {
					style: 'width:calc(100% - 16px);max-width:1250px;box-sizing:border-box;margin:0 0 12px 8px;padding:9px 12px;border-left:4px solid #dc2626;background:#fef2f2;color:#991b1b;font-size:.86rem;line-height:1.5;'
				}, _('Important: TOML may contain tokens, passwords, and certificate paths. Do not screenshot or share it publicly.')),
				toolbar,
				E('div', {
					class: 'frps-toml-compare-grid',
					style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:stretch;width:calc(100% - 16px);max-width:1250px;margin:0 0 0 8px;'
				}, [
					E('section', {
						style: 'min-width:0;padding:12px;border:1px solid #d1d5db;border-radius:8px;'
					}, [
						E('h3', { style: 'margin:0;padding:0;font-size:1rem;' }, _('Saved Configuration Preview')),
						E('p', { style: 'margin:5px 0 0;padding:0;color:#64748b;font-size:.82rem;line-height:1.45;' }, [
							E('strong', {}, _('Configuration path: ')),
							E('code', {}, '/etc/config/frps-advanced')
						]),
						candidateStatus,
						candidateContainer
					]),
					E('section', {
						style: 'min-width:0;padding:12px;border:1px solid #d1d5db;border-radius:8px;'
					}, [
						runtimeTitle,
						E('p', { style: 'margin:5px 0 0;padding:0;color:#64748b;font-size:.82rem;line-height:1.45;' }, [
							E('strong', {}, _('File path: ')),
							runtimePath
						]),
						runtimeStatus,
						runtimeContainer
					])
				])
			])
		]);
	}
});
