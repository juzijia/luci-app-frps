'use strict';
'require view';
'require form';
'require rpc';
'require ui';
'require poll';
'require tools.widgets as widgets';

const callUciGetRaw = rpc.declare({ object: "uci", method: "get", params: ["config"], expect: { "": {} }, reject: true });
const callRestoreConfig = rpc.declare({ object: "luci.frps-advanced", method: "restore_config", params: ["config"], expect: { "": {} }, reject: true });
const callValidateBackup = rpc.declare({ object: 'luci.frps-advanced', method: 'validate_backup', params: ['config'], expect: { '': {} }, reject: true });

// FRPS Advanced - Main Settings (7 tabs)

const BASIC_FIELDS = new Set([
	'enabled',
	'client_file',
	'bindAddr',
	'bindPort',
	'vhostHTTPPort',
	'vhostHTTPSPort',
	'subDomainHost',
	'auth__method',
	'auth__token',
	'webServer__addr',
	'webServer__port',
	'webServer__user',
	'webServer__password',
	'log__level',
]);

const runConf = [
	[form.Flag, 'enabled', _('Enable service'), null, {default: '0', optional: false, rmempty: false, forcewrite: true}],
	[form.Value, 'client_file', _('frps executable'), _('Path to the frps binary file'), {datatype: 'file', default: '/usr/bin/frps'}],
	[widgets.UserSelect, 'run_user', _('Run daemon as user'), _('Default: root'), {}],
	[form.ListValue, 'log__level', _('Log level'), _('Use info for daily use; debug/trace for short-term troubleshooting.'), {default: 'info', optional: false, rmempty: false}],
	[form.Flag, 'respawn', _('Respawn when crashed'), null, {default: '1'}],
];

const networkConf = [
	[form.Value, 'bindAddr', _('Bind address'), _('BindAddr specifies the address that the server binds to.'), {datatype: 'host', placeholder: '0.0.0.0'}],
	[form.Value, 'bindPort', _('Bind port'), _('BindPort specifies the port that the server listens on.'), {datatype: 'port', placeholder: '7000'}],
	[form.Value, 'proxyBindAddr', _('Proxy bind address'), _('Address proxies listen on; defaults to bindAddr when empty.'), {datatype: 'host'}],
	[form.Value, 'kcpBindPort', _('KCP bind port'), _('UDP port; leave empty to disable KCP.'), {datatype: 'port'}],
	[form.Value, 'quicBindPort', _('QUIC bind port'), _('UDP port; leave empty to disable QUIC.'), {datatype: 'port'}],
	[form.Value, 'vhostHTTPPort', _('Vhost HTTP port'), _('Required to support HTTP-type proxies.'), {datatype: 'port'}],
	[form.Value, 'vhostHTTPTimeout', _('Vhost HTTP timeout'), _('Unit: seconds; default 60.'), {datatype: 'uinteger', placeholder: '60'}],
	[form.Value, 'vhostHTTPSPort', _('Vhost HTTPS port'), _('Required to support HTTPS-type proxies.'), {datatype: 'port'}],
	[form.Value, 'tcpmuxHTTPConnectPort', _('TCPMux HTTP CONNECT port'), _('Port for tcpmux proxies using the httpconnect multiplexer.'), {datatype: 'port'}],
	[form.Flag, 'tcpmuxPassthrough', _('TCPMux passthrough'), _('Pass through CONNECT requests for tcpmux proxies.'), {datatype: 'bool'}],
	[form.Value, 'subDomainHost', _('Subdomain root domain'), _('Suffix for subdomain-based proxies; requires vhost HTTP/HTTPS ports.'), {datatype: 'host'}],
	[form.Value, 'custom404Page', _('Custom 404 page'), null, {datatype: 'file'}]
];

const securityConf = [
	[form.Value, 'auth__token', _('Authentication token'), _('Use a sufficiently long random token.'), {password: true}],
	[form.Value, 'auth__tokenSource__file__path', _('Read token from file'), _('Frp 0.64.0+. Avoids token appearing in generated TOML.'), {datatype: 'file'}],
	[form.Value, 'auth__additionalScopes', _('Additional auth scopes'), _('Comma-separated: HeartBeats, NewWorkConns.'), {placeholder: 'HeartBeats,NewWorkConns'}],
	[form.Value, 'auth__oidc__issuer', _('OIDC Issuer'), _('OIDC token issuer URL.'), {}],
	[form.Value, 'auth__oidc__audience', _('OIDC Audience'), _('Required audience value; skip check if empty.'), {}],
	[form.Flag, 'auth__oidc__skipExpiryCheck', _('OIDC skip expiry check'), _('Debug only.'), {datatype: 'bool'}],
	[form.Flag, 'auth__oidc__skipIssuerCheck', _('OIDC skip issuer check'), _('Special compatibility only.'), {datatype: 'bool'}],
	[form.Flag, 'transport__tls__force', _('Only accept TLS control connections'), null, {datatype: 'bool'}],
	[form.Value, 'transport__tls__certFile', _('TLS server certificate'), null, {datatype: 'file'}],
	[form.Value, 'transport__tls__keyFile', _('TLS server private key'), null, {datatype: 'file'}],
	[form.Value, 'transport__tls__trustedCaFile', _('TLS client CA'), _('Enables client certificate verification and forces TLS.'), {datatype: 'file'}],
	[form.Value, 'transport__tls__serverName', _('TLS certificate name'), _('Override Server Name in certificate verification.'), {}],
	[form.Flag, 'detailedErrorsToClient', _('Detailed errors to client'), _('Debug only.'), {datatype: 'bool', default: 'true'}]
];

const dashboardConf = [
	[form.Value, 'webServer__addr', _('Management panel address'), _('Default is 127.0.0.1. Set to 0.0.0.0 to listen on all network interfaces.'), {datatype: 'ipaddr', placeholder: '127.0.0.1'}],
	[form.Value, 'webServer__port', _('Dashboard port'), _('Leave empty to disable the dashboard.'), {datatype: 'port'}],
	[form.Value, 'webServer__user', _('Dashboard user'), {}],
	[form.Value, 'webServer__password', _('Dashboard password'), null, {password: true}],
	[form.Value, 'webServer__tls__certFile', _('Dashboard TLS certificate'), null, {datatype: 'file'}],
	[form.Value, 'webServer__tls__keyFile', _('Dashboard TLS private key'), null, {datatype: 'file'}],
	[form.Value, 'webServer__tls__trustedCaFile', _('Dashboard TLS trusted CA'), null, {datatype: 'file'}],
	[form.Value, 'webServer__tls__serverName', _('Dashboard TLS certificate name'), _('Override Server Name in dashboard TLS config.'), {}],
	[form.Value, 'webServer__assetsDir', _('Dashboard static assets directory'), _('Debug only; leave empty to use built-in resources.'), {}],
	[form.Flag, 'enablePrometheus', _('Enable Prometheus metrics'), _('Access via /metrics when dashboard port is configured.'), {datatype: 'bool'}],
	[form.Flag, 'webServer__pprofEnable', _('Enable pprof'), _('Troubleshooting only.'), {datatype: 'bool'}],
];

const performanceConf = [
	[form.Flag, 'transport__tcpMux', _('TCP multiplexing'), _('Allows multiple requests from a client to share a single TCP connection.'), {datatype: 'bool', default: 'true'}],
	[form.Value, 'transport__tcpMuxKeepaliveInterval', _('TCP mux keepalive interval'), _('Unit: seconds; default 30. TCP mux heartbeat interval; tune only when mux stability issues occur.'), {datatype: 'uinteger', placeholder: '30'}],
	[form.Value, 'transport__tcpKeepalive', _('TCP keepalive interval'), _('Unit: seconds; default 7200. Negative disables keepalive.'), {datatype: 'integer', placeholder: '7200'}],
	[form.Value, 'transport__maxPoolCount', _('Max connection pool count'), _('Default 5. Larger client values are forced down; bigger pools use more connections and memory.'), {datatype: 'uinteger', placeholder: '5'}],
	[form.Value, 'transport__heartbeatTimeout', _('Heartbeat timeout'), _('Unit: seconds. A client without a heartbeat for longer than this value is considered disconnected (effective when TCPMux is disabled).'), {datatype: 'integer', placeholder: '90'}],
	[form.Value, 'transport__quic__keepalivePeriod', _('QUIC keepalive period'), _('Unit: seconds.'), {datatype: 'integer', placeholder: '10'}],
	[form.Value, 'transport__quic__maxIdleTimeout', _('QUIC max idle timeout'), _('Unit: seconds.'), {datatype: 'integer', placeholder: '30'}],
	[form.Value, 'transport__quic__maxIncomingStreams', _('QUIC max incoming streams'), null, {datatype: 'uinteger', placeholder: '100000'}],
	[form.Value, 'maxPortsPerClient', _('Max ports per client'), _('0 means unlimited.'), {datatype: 'uinteger', placeholder: '0'}],
	[form.Value, 'allowPorts', _('Allow ports'), _('Comma/space separated port ranges. Empty means all allowed.'), {placeholder: '80,443,6000-7000'}],
	[form.Value, 'userConnTimeout', _('User connection timeout'), _('Unit: seconds; default 10. Timeout waiting for the client response after a user connection is established.'), {datatype: 'uinteger', placeholder: '10'}],
	[form.Value, 'udpPacketSize', _('UDP packet size'), _('Default 1500.'), {datatype: 'uinteger', placeholder: '1500'}],
	[form.Value, 'natholeAnalysisDataReserveHours', _('NAT hole analysis data reserve hours'), _('Unit: hours; default 168 (7 days). Only affects NAT hole punching scenarios.'), {datatype: 'uinteger', placeholder: '168'}]
];

const advancedConf = [
	[form.Value, 'sshTunnelGateway__bindPort', _('SSH tunnel gateway port'), _('Leave empty to disable.'), {datatype: 'port'}],
	[form.Value, 'sshTunnelGateway__privateKeyFile', _('SSH private key'), null, {datatype: 'file'}],
	[form.Value, 'sshTunnelGateway__autoGenPrivateKeyPath', _('Auto-gen SSH private key path'), null, {placeholder: '/etc/frp/.autogen_ssh_key'}],
	[form.Value, 'sshTunnelGateway__authorizedKeysFile', _('SSH authorized_keys'), null, {datatype: 'file'}],
	[form.DynamicList, 'extra_setting', _('Raw TOML options'), _('Experimental fields only. Each line appended as-is; avoid duplicating existing fields.'), {placeholder: 'version = "1"'}]
];


function setParams(o, params) {
	if (!params) return;
	for (let key in params) {
		let val = params[key];
		if (key === 'values') {
			for (let v of val) {
				let args = v;
				if (!Array.isArray(args)) args = [args];
				o.value.apply(o, args);
			}
		} else if (key === 'depends') {
			if (!Array.isArray(val)) val = [val];
			for (let v of val) {
				let args = v;
				if (!Array.isArray(args)) args = [args];
				o.depends.apply(o, args);
			}
		} else {
			o[key] = params[key];
		}
	}
	if (params['datatype'] === 'bool') {
		o.enabled = 'true';
		o.disabled = 'false';
	}
}

function markAdvancedOption(option) {
	var render = option.render;
	option.render = function() {
		return Promise.resolve(render.apply(this, arguments)).then(function(row) {
			if (row && row.classList)
				row.classList.add('frps-advanced-field');
			return row;
		});
	};
}

function defTabOpts(s, t, opts, params) {
	for (let opt of opts) {
		const o = s.taboption(t, opt[0], opt[1], opt[2], opt[3]);
		setParams(o, opt[4]);
		setParams(o, params);
	}
}

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

const callGetVersion = rpc.declare({
	object: 'luci.frps-advanced',
	method: 'get_version',
	expect: { '': {} }
});

const callUciGet = rpc.declare({
	object: 'uci',
	method: 'get',
	params: ['config'],
	expect: { values: {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('frps-advanced'), {}).then(function (res) {
		var running = false;
		var hasInstances = false;
		try {
			var instances = res['frps-advanced'] && res['frps-advanced']['instances'];
			if (instances) {
				hasInstances = true;
				for (var k in instances) {
					if (instances[k] && instances[k].running) {
						running = true;
						break;
					}
				}
			}
		} catch (e) { }
		return L.resolveDefault(callUciGet('frps-advanced'), {}).then(function (uc) {
			var enabled = false;
			try {
				if (uc.main && uc.main.enabled !== undefined)
					enabled = uc.main.enabled === '1';
				else if (uc.values && uc.values.main && uc.values.main.enabled !== undefined)
					enabled = uc.values.main.enabled === '1';
			} catch (e) { }
			var start_failed = enabled && hasInstances && !running;
			return { ok: true, running: !!running, enabled: !!enabled, start_failed: start_failed };
		}, function () {
			return { ok: false };
		});
	}, function () {
		return { ok: false };
	});
}

function renderStatus(st) {
	var color, text;
	if (!st || !st.ok) {
		color = 'orange';
		text = _('Unable to read service status');
	} else if (!st.enabled) {
		color = 'gray';
		text = _('Frp server not enabled');
	} else if (st.running) {
		color = 'green';
		text = _('Frp server running');
	} else if (st.start_failed === true) {
		color = 'red';
		text = _('Frp server start failed');
	} else {
		color = '#b45309';
		text = _('Frp server stopped');
	}
	return String.format('<em><span style=\"color:%s\"><strong>%s</strong></span></em>', color, text);
}



return view.extend({
	render() {
		var m, s, o;

		document.querySelector('head').appendChild(
			E('style', { type: 'text/css' },
				'@media(min-width:992px){' +
				'.frps-advanced-root .cbi-value-field{max-width:520px}' +
				'.frps-advanced-root .cbi-value-description{max-width:520px}' +
				'.frps-advanced-root .cbi-map-form{max-width:100%}' +
				'.frps-advanced-root .cbi-value-title{text-align:left;white-space:normal;width:220px;max-width:220px}' +
				'.frps-advanced-root td.cbi-value-title{padding-left:0;padding-right:16px}' +
				'}' +
				'.frp-help-icon{display:inline-block;cursor:help;margin-left:5px;color:#818cf8;font-weight:bold;font-size:.88rem;position:relative;vertical-align:middle;user-select:none;-webkit-user-select:none}' +
				'.cbi-tooltip.frp-help-tooltip{box-sizing:border-box;background:#1e293b;color:#f1f5f9;padding:10px 14px;border-radius:8px;font-size:.82rem;font-weight:normal;white-space:pre-line;line-height:1.45;box-shadow:0 6px 18px rgba(0,0,0,.28);pointer-events:none;width:max-content;max-width:min(420px,calc(100vw - 24px));overflow-wrap:anywhere;word-break:normal}' +
				'.frp-version-line{margin-top:6px;font-size:.82rem}' +
				'.frp-version-label{color:#64748b}' +
				'.frp-version-value{font-weight:600;color:#334155;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:1px 8px;margin-left:4px;font-size:.85rem}' +
				'.frp-version-checking{color:#64748b}' +
				'.frp-version-pending{color:#64748b}' +
				'.frp-version-missing{color:#b45309}' +
				'.frp-version-error{color:#9a3412}' +
			'.frps-ui-basic .frps-advanced-field { display: none; }' +
			'.frps-ui-basic .cbi-tabmenu > li[data-tab="performance"] { display: none !important; }' +
			'.frps-mode-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; box-sizing: border-box; margin-bottom: 12px; padding: 0 16px; }' +
			'.frps-mode-title { flex: 0 0 auto; font-size: .88rem; color: #1f2937; white-space: nowrap; }' +
			'.frps-mode-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }' +
			'.frps-mode-desc { flex: 1 1 260px; min-width: 0; font-size: .8rem; line-height: 1.4; color: #6b7280; }' +
			'.frps-page-description { margin: 0 0 8px; }' +
			'.frps-status-panel { margin: 0 0 8px; }' +
			'.frps-status-panel .cbi-section, .frps-status-panel p { margin: 0; }'));

		// --- Basic/Advanced mode toggle ---
		var uiMode = localStorage.getItem('frps-advanced-ui-mode');
		var currentMode = (uiMode === 'advanced') ? 'advanced' : 'basic';

		function leavePerformanceTabForBasic(form, mode) {
			if (mode !== 'basic') return;
			var performanceTab = form.querySelector('.cbi-tabmenu > li[data-tab="performance"]');
			if (!performanceTab || !performanceTab.classList.contains('cbi-tab')) return;
			var runTabLink = form.querySelector('.cbi-tabmenu > li[data-tab="run"] a');
			if (runTabLink) runTabLink.click();
		}

		function applyUiMode(form, mode) {
			leavePerformanceTabForBasic(form, mode);
			form.classList.toggle('frps-ui-basic', mode === 'basic');
		}

		function setUiMode(mode) {
			localStorage.setItem('frps-advanced-ui-mode', mode);
			currentMode = mode;
			var form = document.querySelector('.cbi-map');
			if (!form) return;
			applyUiMode(form, mode);
			// Update button states using LuCI native cbi-button classes
			var bar = document.querySelector('.frps-mode-bar');
			if (bar) {
				var btns = bar.querySelectorAll('button.cbi-button');
				if (btns[0]) { btns[0].classList.toggle('cbi-button-action', mode === 'basic'); btns[0].classList.toggle('cbi-button-neutral', mode !== 'basic'); }
				if (btns[1]) { btns[1].classList.toggle('cbi-button-action', mode === 'advanced'); btns[1].classList.toggle('cbi-button-neutral', mode !== 'advanced'); }
				var desc = bar.querySelector('.frps-mode-desc');
				if (desc) desc.textContent = mode === 'basic'
					? _('Show common settings only')
					: _('Show all settings');
			}
		}

		function renderModeSelector() {
			return E('div', { class: 'frps-mode-bar' }, [
				E('span', { class: 'frps-mode-title' }, _('Display mode')),
				E('div', { class: 'frps-mode-buttons' }, [
					E('button', {
						class: 'cbi-button ' + (currentMode === 'basic' ? 'cbi-button-action' : 'cbi-button-neutral'),
						click: function() { setUiMode('basic'); }
					}, _('Basic')),
					E('button', {
						class: 'cbi-button ' + (currentMode === 'advanced' ? 'cbi-button-action' : 'cbi-button-neutral'),
						click: function() { setUiMode('advanced'); }
					}, _('Advanced'))
				]),
				E('span', { class: 'frps-mode-desc' },
					currentMode === 'basic' ? _('Show common settings only') :
						_('Show all settings')
				)
			]);
		}

		function renderStatusPanel() {
			poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function(res) {
					var view = document.getElementById('service_status');
					if (view) view.innerHTML = renderStatus(res);
				});
			});
			return E('div', { class: 'frps-status-panel' },
				E('fieldset', { class: 'cbi-section' }, [
					E('p', { id: 'service_status' }, _('Collecting data ...'))
				])
			);
		}

		var pageDescription = E('p', { class: 'cbi-map-descr frps-page-description' }, [
			_('Frp server management interface. Saving updates UCI only; TOML is generated on apply.'),
			' ', E('a', { href: 'https://github.com/fatedier/frp', target: '_blank', rel: 'noreferrer' }, 'GitHub'),
			' ', E('a', { href: 'https://gofrp.org/zh-cn/docs/reference/server-configures/', target: '_blank', rel: 'noreferrer' }, _('Configuration Reference'))
		]);
		var statusPanel = renderStatusPanel();

		m = new form.Map('frps-advanced');

		s = m.section(form.NamedSection, 'main', 'frps');
		s.dynamic = true;

		s.tab('run', _('Run & Log'));
		s.tab('network', _('Listen & Route'));
		s.tab('security', _('Auth & TLS'));
		s.tab('dashboard', _('Dashboard'));
		s.tab('performance', _('Transport & Limits'));
		s.tab('advanced', _('Extensions'));

		defTabOpts(s, 'run', runConf, {optional: true});
		// Customize run_user: default root, no empty option
		for (var _ri = 0; _ri < s.children.length; _ri++) {
			if (s.children[_ri].option === 'run_user') {
				s.children[_ri].default = 'root';
				s.children[_ri].rmempty = false;
				s.children[_ri].optional = false;
			}
			if (s.children[_ri].option === 'enabled') {
				s.children[_ri].optional = false;
				s.children[_ri].rmempty = false;
				s.children[_ri].forcewrite = true;
				s.children[_ri].default = '0';
			}
		}

		defTabOpts(s, 'network', networkConf, {optional: true});

		// Security tab with auth method selector and depends
		o = s.taboption('security', form.ListValue, 'auth__method', _('Authentication method'),
			_('Token suits most deployments; OIDC for unified identity environments.'));
		o.value('token', _('Token'));
		o.value('oidc', _('OIDC'));
		o.default = 'token';

		for (var i = 0; i < securityConf.length; i++) {
			var opt = securityConf[i];
			o = s.taboption('security', opt[0], opt[1], opt[2], opt[3]);
			setParams(o, opt[4]);
			if (opt[1] === 'auth__token' || opt[1] === 'auth__tokenSource__file__path')
				o.depends('auth__method', 'token');
			if (opt[1].indexOf('auth__oidc__') === 0)
				o.depends('auth__method', 'oidc');
			setParams(o, {optional: true});
		}

		defTabOpts(s, 'dashboard', dashboardConf, {optional: true});

		// Add log level values
		var logLevelF = null;
		for (var i = 0; i < s.children.length; i++) {
			if (s.children[i].option === 'log__level') { logLevelF = s.children[i]; break; }
		}
		if (logLevelF) {
			logLevelF.default = 'info';
			logLevelF.optional = false;
			logLevelF.rmempty = false;
			logLevelF.value('trace', _('trace'));
			logLevelF.value('debug', _('debug'));
			logLevelF.value('info', _('info'));
			logLevelF.value('warn', _('warn'));
			logLevelF.value('error', _('error'));
		}

		defTabOpts(s, 'performance', performanceConf, {optional: true});

		defTabOpts(s, 'advanced', advancedConf, {optional: true});

		// Backup & Restore section inside Extensions tab
		var backupSection = s.taboption('advanced', form.DummyValue, '_backup_restore', _('Configuration Backup & Restore'));
		backupSection.description = _('Export or restore FRP configuration. Service and executable settings are preserved. Only accepts JSON backups exported by this plugin.');
		backupSection.cfgvalue = function() { return ''; };
		backupSection.render = function(sid) { return buildBackupRestoreWidget(m); };

		// Basic mode is an explicit whitelist; every other current or future field is Advanced.
		for (var uiIndex = 0; uiIndex < s.children.length; uiIndex++) {
			var optionName = s.children[uiIndex].option;
			if (optionName && optionName !== '_backup_restore' && !BASIC_FIELDS.has(optionName))
				markAdvancedOption(s.children[uiIndex]);
		}

		// ─── Field help data (complex / risky / ambiguous fields) ───
		var fieldHelp = {
			// A-level: fields with independent risk or special semantics
			'run_user': { body: _('To reduce privileges, select a different system user and ensure that user has permissions to read the configuration file, certificates, and keys.') },

			'bindAddr': { body: _('Controls which network interface accepts frpc control connections. Default 0.0.0.0 listens on all interfaces. Use 127.0.0.1 to restrict to local connections only.') },
			'kcpBindPort': { body: _('UDP port for KCP protocol used by clients that select KCP transport. Leave empty to disable KCP. Requires bindPort as well; KCP helps on lossy networks but is usually slower on stable ones.') },
			'quicBindPort': { body: _('UDP port for QUIC protocol used by clients that select QUIC transport. Leave empty to disable QUIC. Requires bindPort as well.') },
			'vhostHTTPTimeout': { body: _('Timeout for waiting for the HTTP response header from the target server, in seconds (default 60). Increase for slow upstream web servers.') },
			'auth__token': { body: _('Shared secret that clients must present when connecting. Use a long random value. Mutually exclusive with "Read token from file"; without a token file the token appears in the generated TOML.') },
			'transport__tls__force': {
				title: _('TLS Force'),
				body: _('When enabled, frps will only accept control connections encrypted with TLS. Non-TLS clients are rejected. Default: off. Scenario: public networks or untrusted LAN environments. Risk: legacy clients without TLS support will be unable to connect. Requires TLS certificate and key to be configured.') + '\n\n' + _('Note: configuring a TLS client CA (trustedCaFile) automatically forces TLS regardless of this toggle.')
			},
			'transport__tcpMux': { body: _('TCP multiplexing lets a client share one TCP connection for multiple proxies (enabled by default). Disable for maximum compatibility with unusual NAT or firewall setups; connection count increases when disabled.') },
			'transport__heartbeatTimeout': { body: _('When TCPMux is enabled, the multiplexed connection mechanism maintains connection state, so this value does not take effect.') },
			'maxPortsPerClient': { body: _('Maximum number of simultaneous proxies a single client may create. 0 or empty means unlimited. Useful to cap resource usage per client.') },
			'allowPorts': { body: _('Ports that proxies are allowed to bind on, e.g. 80,443,6000-7000. Empty means all ports are allowed. Restricting this is a security best practice when clients are untrusted.') },
			'detailedErrorsToClient': { body: _('Returns detailed error messages to clients (default enabled). Useful for debugging but may leak internal details; disable in production if concerned.') },
			'udpPacketSize': { body: _('Maximum UDP packet size when proxying UDP services (default 1500). Server and client values must match.') },
			'extra_setting': { body: _('Raw TOML lines appended to the generated configuration for experimental fields not covered by this form. Invalid TOML or duplicate keys can make the service fail to apply. Avoid adding options that already exist above.') },
			// B-level: one group anchor per related field group
			'transport__tls__certFile': { body: _('TLS settings for control connections: certFile must be paired with keyFile; trustedCaFile enables client certificate verification and forces TLS (mutual TLS); serverName overrides the verified Server Name and is only needed in special certificate setups. Required when "Only accept TLS control connections" is enabled.') },
			'webServer__addr': { body: _('Default is 127.0.0.1 for local access only. Set it to 0.0.0.0 to allow LAN access. WAN access is controlled by the OpenWrt / ImmortalWrt firewall rules. Configure a management panel username and password to prevent unauthorized access.') },
			'webServer__tls__certFile': { body: _('Dashboard TLS settings: certFile and keyFile must be paired to serve the dashboard over HTTPS; trustedCaFile enables client certificate verification (mutual TLS, usually not needed); serverName overrides the verified Server Name in special setups.') },
			'enablePrometheus': { body: _('Monitoring and debugging endpoints: Prometheus metrics are served at /metrics only when the dashboard port is configured; pprof exposes Go runtime profiling data. Keep both disabled or protected in production.') },
			'transport__quic__keepalivePeriod': { body: _('QUIC tuning options for QUIC transport clients: keepalivePeriod (default 10s), maxIdleTimeout (default 30s), maxIncomingStreams (default 100000). Only relevant when clients use QUIC.') },
			'sshTunnelGateway__bindPort': { body: _('SSH tunnel gateway: bindPort exposes an SSH endpoint on the server (leave empty to disable); privateKeyFile is the server key (empty uses the auto-generated key); autoGenPrivateKeyPath generates an RSA key when missing (default ./.autogen_ssh_key); authorizedKeysFile enables passwordless client authentication when set.') },
			'auth__oidc__issuer': { body: _('OIDC authentication group: issuer and audience define how client tokens are validated; skipExpiryCheck and skipIssuerCheck disable security checks for debugging or special compatibility only.') },

			// C-level: newly added individual field tooltips
			'proxyBindAddr': { body: _('Address on which proxy listeners bind. Leave empty to use bindAddr. This is an IP/listen address, not a port.') },
			'auth__tokenSource__file__path': { body: _('Reads the authentication token from a plain text file. The file contains only the token value. Do not configure this together with an inline token.') },
			'auth__additionalScopes': { body: _('Extends authentication to additional FRP operations such as HeartBeats and NewWorkConns. Usually leave empty unless specifically required.') },
			'transport__tls__trustedCaFile': { body: _('CA certificate used to verify client certificates for mutual TLS (mTLS). Leave empty for normal TLS.') },
			'transport__tls__serverName': { body: _('Overrides the Server Name used during certificate verification. Usually leave empty unless certificate verification requires a specific name.') },
			'transport__quic__maxIncomingStreams': { body: _('Maximum concurrent incoming QUIC streams per connection. Only relevant when QUIC transport is used; normally keep the default.') },
			'natholeAnalysisDataReserveHours': { body: _('Retention time for NAT hole-punching analysis data, in hours. Normally no adjustment is required.') }
		};

		// Use LuCI's native data-tooltip handling; ui.js owns show/hide/positioning.
		function addFieldHelp(label, optName) {
			var h = fieldHelp[optName];
			if (!h || !label || label.querySelector('[data-frp-help="' + optName + '"]')) return;
			var title = h.title || label.textContent.trim();
			label.appendChild(E('span', {
				class: 'frp-help-icon',
				'data-frp-help': optName,
				'data-tooltip': title + '\n' + h.body,
				'data-tooltip-style': 'frp-help-tooltip',
				tabindex: '0',
				'aria-label': title
			}, '\u24D8'));
		}

		function postProcessForm(root) {
			var renderedForm = root.querySelector('.cbi-map');
			if (renderedForm)
				applyUiMode(renderedForm, currentMode);

			for (var k in fieldHelp) {
				var row = root.querySelector('[id$="-' + k + '"]');
				if (!row) continue;
				var label = row.querySelector('.cbi-value-title');
				if (!label) continue;
				addFieldHelp(label, k);
			}

			// Fix label[for] matching: UICheckbox uses random id, but label.for
			// points to widget.cbid.xxx which only exists as data-widget-id.
			// Re-point label.for to the checkbox's actual id to silence warnings.
			var badLabels = root.querySelectorAll('label[for^="widget.cbid"]');
			for (var bi = 0; bi < badLabels.length; bi++) {
				var lbl = badLabels[bi];
				var widgetId = lbl.getAttribute('for');
				var input = root.querySelector('input[data-widget-id="' + widgetId + '"], [data-widget-id^="widget.' + widgetId + '"]');
				if (!input) input = root.querySelector('input[data-widget-id="widget.' + widgetId + '"]');
				if (input && input.id) lbl.setAttribute('for', input.id);
			}

			// Dynamic binary version detection under the executable field.
			// The RPC reads the saved UCI client_file itself; an unsaved path
			// is only announced, never executed.
			var binRow = root.querySelector('[id$="-client_file"]');
			if (binRow) {
				var binInput = binRow.querySelector('input');
				var binField = binRow.querySelector('.cbi-value-field');
				var statusEl = E('span', { class: 'frp-version-checking' }, _('Detecting version…'));
				var versionLine = E('div', { class: 'frp-version-line' }, statusEl);
				if (binField) binField.appendChild(versionLine);
				var savedPath = '/usr/bin/frps';
				for (var i = 0; i < s.children.length; i++) {
					if (s.children[i].option === 'client_file') {
						try {
							var pv = s.children[i].cfgvalue('main');
							if (pv) savedPath = pv;
						} catch (e) { }
						break;
					}
				}
				var lastChecked = null;

				function setVersionStatus(cls, textOrNode) {
					statusEl.className = cls;
					statusEl.innerHTML = '';
					if (typeof textOrNode === 'string')
						statusEl.textContent = textOrNode;
					else if (textOrNode)
						statusEl.appendChild(textOrNode);
				}

				function detectVersion() {
					var path = (binInput.value || '').trim();
					if (!path) path = '/usr/bin/frps';
					if (path !== savedPath) {
						lastChecked = null;
						setVersionStatus('frp-version-pending', _('Check version after saving the new path'));
						return;
					}
					if (path === lastChecked) return;
					lastChecked = path;
					setVersionStatus('frp-version-checking', _('Detecting version…'));
					L.resolveDefault(callGetVersion()).then(function (res) {
						if (path !== lastChecked) return;
													// Parse response defensively: handle both direct {status,version}
							// and wrapped {result:{status,version}} from deferred ubus replies.
							var data = res;
							if (res && typeof res === 'object' && res.result && typeof res.result === 'object')
								data = res.result;
							if (data && data.status === 'ok' && data.version) {
							var node = E('span', { class: 'frp-version-ok' }, [
								E('span', { class: 'frp-version-label' }, _('Current version') + ' '),
								E('strong', { class: 'frp-version-value' }, data.version)
							]);
							setVersionStatus('', node);
						} else if (data && data.status === 'error' &&
						           (data.code === 'not_executable' || data.code === 'invalid_path')) {
							setVersionStatus('frp-version-missing', _('Frp executable not found; install or upload it and retry'));
						} else {
							setVersionStatus('frp-version-error', _('Unable to read version; refresh and retry'));
						}
					}, function () {
						if (path !== lastChecked) return;
						setVersionStatus('frp-version-error', _('Unable to read version; refresh and retry'));
					});
				}

				detectVersion();
				binInput.addEventListener('change', function () {
					clearTimeout(binInput.__frpCheckTimer);
					binInput.__frpCheckTimer = setTimeout(detectVersion, 400);
				});
				binInput.addEventListener('blur', function () {
					clearTimeout(binInput.__frpCheckTimer);
					binInput.__frpCheckTimer = setTimeout(detectVersion, 250);
				});
			}

		}

		m._frpsPostProcess = function() {
			var root = m.root ? m.root.closest('.frps-advanced-root') : null;
			if (root)
				postProcessForm(root);
		};

		return m.render().then(function(content) {
			var modeBar = renderModeSelector();
			var root = E('div', { class: 'frps-advanced-root' }, [pageDescription, statusPanel, modeBar, content]);
			postProcessForm(root);
			return root;
		});
	}
});

// ─── Backup & Restore UI (standalone DOM, NOT a UCI form section) ───

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeUciSections(raw) {
	if (!isPlainObject(raw)) throw new Error("UCI RPC did not return an object");
	var sections = isPlainObject(raw.values) ? raw.values : raw;
	if (!isPlainObject(sections)) throw new Error("UCI sections format invalid");
	if (!isPlainObject(sections.main)) throw new Error("No main section found");
	if (sections.main[".type"] !== "frps") throw new Error("main section type is not frps");
	return sections;
}

function readCurrentSections() {
	return callUciGetRaw("frps-advanced").then(normalizeUciSections);
}

function filterSections(sections) {
	if (!isPlainObject(sections)) throw new Error("sections not a plain object");
	var clean = {};
	var deprecatedLoggingKeys = {
		enable_logging: true,
		std_redirect: true,
		log__to: true,
		log__maxDays: true,
		log__disablePrintColor: true
	};
	for (var sn in sections) {
		var s = sections[sn];
		if (!isPlainObject(s)) throw new Error("section " + sn + " is not a plain object");
		clean[sn] = {};
		for (var k in s) {
			if (sn === "main" && (k === ".type" || k === "enabled" || k === "respawn" || k === "client_file" || k === "run_user" || deprecatedLoggingKeys[k])) continue;
			if (k === ".type") { clean[sn][k] = s[k]; continue; }
			if (k === ".name" || k === ".anonymous" || k === ".index") continue;
			if (k[0] === ".") continue;
			var v = s[k];
			if (v === null || v === undefined || typeof v === "function") continue;
			if (typeof v === "object" && !Array.isArray(v)) continue;
			clean[sn][k] = v;
		}
	}
	if (!isPlainObject(clean["main"])) throw new Error("No valid main section after filtering");
	return clean;
}

function buildExportPayload(filtered) {
	var payload = {
		format: 'frps-advanced-backup',
		schemaVersion: 1,
		config: filtered.main
	};
	var plugins = [];

	for (var sn in filtered) {
		if (sn === 'main') continue;
		if (filtered[sn]['.type'] !== 'http_plugin')
			throw new Error('Unknown section type: ' + (filtered[sn]['.type'] || 'none'));

		var plugin = {};
		for (var k in filtered[sn]) {
			if (k !== '.type') plugin[k] = filtered[sn][k];
		}
		plugins.push(plugin);
	}

	if (plugins.length) payload.httpPlugins = plugins;
	return payload;
}

function validateImportBackup(data) {
	if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Top-level JSON is not an object");
	if (data.format !== "frps-advanced-backup") throw new Error("Unsupported format: " + (data.format || "none"));
	var badProto = ["__proto__", "constructor", "prototype"];

	if (data.schemaVersion !== 1) throw new Error("Unsupported schema version: " + (data.schemaVersion || "none"));
	var forbidden = ["sections", "main", ".type", "enabled", "application", "uciConfig", "exportedAt"];
	for (var fi = 0; fi < forbidden.length; fi++) {
		if (Object.prototype.hasOwnProperty.call(data, forbidden[fi])) throw new Error("Illegal field: " + forbidden[fi]);
	}
	if (!isPlainObject(data.config)) throw new Error("config must be an object");
	for (var ck in data.config) {
		if (ck === "respawn") continue;
		if (badProto.indexOf(ck) >= 0 || ck[0] === "." || ck === "enabled") throw new Error("Illegal field: config." + ck);
		var cv = data.config[ck];
		if (cv !== null && typeof cv === "object" && !Array.isArray(cv)) throw new Error("config." + ck + " contains nested object");
	}
	if (data.httpPlugins !== undefined) {
		if (!Array.isArray(data.httpPlugins)) throw new Error("httpPlugins must be an array");
		for (var pi = 0; pi < data.httpPlugins.length; pi++) {
			var plugin = data.httpPlugins[pi];
			if (!isPlainObject(plugin)) throw new Error("httpPlugins[" + pi + "] is not a plain object");
			for (var pk in plugin) {
				if (badProto.indexOf(pk) >= 0 || pk[0] === ".") throw new Error("Illegal field: httpPlugins[" + pi + "]." + pk);
				var pv = plugin[pk];
				if (pv !== null && typeof pv === "object" && !Array.isArray(pv)) throw new Error("httpPlugins[" + pi + "]." + pk + " contains nested object");
			}
		}
	}
}

function buildBackupRestoreWidget(map) {
	var HELP_TIP = _('Import will overwrite the saved FRP configuration. Service enablement, executable path, and run user are preserved.');
	var restoreInlineStatus = map && map._frpsRestoreInlineStatus;
	var selectedBackupFile = null;
	var validatedBackupData = null;
	var importValidationError = null;
	var importInProgress = false;
	var backendValidationResult = null;
	var validationInProgress = false;

	var stEl = E('div',{style:'display:none;margin-top:10px;padding:8px 10px;max-width:960px;border-radius:4px;font-size:13px;line-height:1.5;border:1px solid #e2e8f0;word-break:break-word'});
	var fi = E('input',{type:'file',id:'frp-file-input',accept:'.json,application/json',style:'display:none'});

	function ss(m,e){
		stEl.textContent=m;
		stEl.style.display=m?'':'none';
		if(e){stEl.style.color='#b91c1c';stEl.style.background='#fef2f2';stEl.style.borderColor='#fecaca';}
		else{stEl.style.color='#475569';stEl.style.background='#f8fafc';stEl.style.borderColor='#e2e8f0';}
	}

	if (map)
		delete map._frpsRestoreInlineStatus;
	if (restoreInlineStatus === 'reloaded')
		ss(_('Configuration restored successfully, FRPS has been reloaded.'));
	else if (restoreInlineStatus === 'stopped')
		ss(_('Configuration restored successfully, FRPS is currently not running.'));
	else if (restoreInlineStatus === 'unknown')
		ss(_('Configuration restored successfully, FRPS running state is unknown.'));
	else if (restoreInlineStatus === 'reload_failed')
		ss(_('Configuration restored successfully, but FRPS reload failed.'),true);

	function updateImportButtonState(){
		try{var bi=document.getElementById('frp-import-btn');if(bi)bi.disabled=importInProgress||validationInProgress||!selectedBackupFile||!validatedBackupData||!backendValidationResult||backendValidationResult.ok!==true||importValidationError!==null;}catch(e){}
	}

	fi.addEventListener('change',function(ev){
		var file=ev.target.files&&ev.target.files[0];
		selectedBackupFile=null;validatedBackupData=null;importValidationError=null;
		if(!file){ss(_('No backup file selected.'));updateImportButtonState();return;}
		if(!file.name.endsWith('.json')){ss(_('Please select a .json backup file.'),true);updateImportButtonState();return;}
		if(!file.size||file.size<2){ss(_('File is empty or too small.'),true);updateImportButtonState();return;}
		if(file.size>262144){ss(_('File too large, max 256 KiB.')+' ('+(file.size/1024).toFixed(1)+' KB)',true);updateImportButtonState();return;}
		selectedBackupFile=file;
		ss(_('Reading and validating backup file...'));
		var reader=new FileReader();
		reader.onload=function(e){
			try{
				var parsed=JSON.parse(e.target.result);
				validateImportBackup(parsed);
				validatedBackupData=parsed;
				importValidationError=null;
				backendValidationResult=null;
				validationInProgress=true;
				updateImportButtonState();
				ss(_('Validating backup on router\u2026'),false);
				callValidateBackup(JSON.stringify(parsed)).then(function(result){
					if(result&&result.ok===true){
						backendValidationResult=result;
						importValidationError=null;
						validationInProgress=false;
						var d=result.diff||{};
						var added=(d.added_section_count||0)+(d.added_option_count||0);
						var changed=d.changed_option_count||0;
						var removed=(d.removed_section_count||0)+(d.removed_option_count||0);
						ss(_('Backup validation passed.')+' '+_('Options')+':'+(result.option_count||0)+', '+_('Added')+':'+added+', '+_('Changed')+':'+changed+', '+_('Removed')+':'+removed);
					}else{
						backendValidationResult=null;
						validationInProgress=false;
						importValidationError=result.message||result.err||_('Backend validation failed');
						ss(_('Backup validation failed: ')+importValidationError,true);
					}
					updateImportButtonState();
				}).catch(function(err){
					backendValidationResult=null;
					validationInProgress=false;
					importValidationError=err&&err.message?err.message:String(err);
					ss(_('Unable to validate backup on router: ')+importValidationError,true);
					updateImportButtonState();
				});
			}catch(e2){
				selectedBackupFile=null;
				validatedBackupData=null;
				backendValidationResult=null;
				validationInProgress=false;
				importValidationError=e2.message||'Unknown error';
				ss(_('Backup validation failed: ')+importValidationError,true);
				updateImportButtonState();
			}
		};
		reader.onerror=function(){selectedBackupFile=null;validatedBackupData=null;importValidationError='File read error';ss(_('Failed to read backup file.'),true);updateImportButtonState();};
		reader.readAsText(file);
	});

	function setExportStatus(message,isError){
		expStatusEl.textContent=message||'';
		expStatusEl.style.display=message?'block':'none';
		expStatusEl.style.color=isError?'#b91c1c':'#166534';
		expStatusEl.style.background=isError?'#fef2f2':'#f0fdf4';
		expStatusEl.style.borderColor=isError?'#fecaca':'#bbf7d0';
	}

	function handleExport(){
		readCurrentSections().then(function(sections){
			var filtered=filterSections(sections);
			if(!filtered['main']){setExportStatus(_('No valid frps-advanced UCI config found, backup not generated.'),true);return;}
			if(!Object.keys(filtered).length){setExportStatus(_('No valid frps-advanced UCI config found, backup not generated.'),true);return;}
			var p=buildExportPayload(filtered);
			var optCount=0;
			for(var sn in filtered){for(var k in filtered[sn]){if(k[0]!=='.')optCount++;}}
			var doExport=function(){
				var n=new Date();
				var ts=n.getFullYear()+('0'+(n.getMonth()+1)).slice(-2)+('0'+n.getDate()).slice(-2)+'-'+('0'+n.getHours()).slice(-2)+('0'+n.getMinutes()).slice(-2)+('0'+n.getSeconds()).slice(-2);
				var b=new Blob([JSON.stringify(p,null,2)],{type:'application/json;charset=utf-8'});
				var a=document.createElement('a');
				a.href=URL.createObjectURL(b);
				a.download='frps-advanced-backup-'+ts+'.json';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(a.href);
				setExportStatus(_('Backup exported successfully.'),false);
			};
			var msg=_("Important: The backup file contains tokens, passwords, and other sensitive information. Keep it secure.")+'\n\n'+_("This backup will contain %s configuration options.").replace('%s',optCount);
			ui.showModal(_('Export Configuration'),[
				E('p',{style:'white-space:pre-line;max-width:460px'},msg),
				E('div',{style:'display:flex;gap:8px;margin-top:12px;justify-content:flex-end'},[
					E('button',{class:'btn cbi-button',click:ui.hideModal},_('Cancel')),
					E('button',{class:'btn cbi-button cbi-button-apply',click:function(ev){ev.currentTarget.disabled=true;ui.hideModal();doExport();}},_('Confirm Export'))
				])
			]);
		}).catch(function(e){setExportStatus(_('Export failed: ')+(e.message||e),true);});
	}
	function handleImport(){
		if(!validatedBackupData){ss(_('No validated backup data available.'),true);return;}
		if(!selectedBackupFile){ss(_('No backup file selected.'),true);return;}
		importInProgress=true;
		updateImportButtonState();
		ss(_('Importing...'));
		callRestoreConfig(JSON.stringify(validatedBackupData)).then(function(result){
			var restoreStatus=null;
			if(!result||result.ok!==true){
				if(result&&result.code==='SERVICE_RESTART_FAILED'&&result.config_restored===true){
					restoreStatus='reload_failed';
				}else{
					var code=result&&result.code?' ['+result.code+']':'';
					var stage=result&&result.stage?' ['+result.stage+']':'';
					var msg=result&&(result.message||result.err)?(result.message||result.err):'Import failed';
					throw new Error(msg+code+stage);
				}
			}else if(result.service_state==='running'&&result.runtime_synchronized===true){
				restoreStatus='reloaded';
			}else if(result.service_state==='stopped'){
				restoreStatus = 'stopped';
			}else{
				restoreStatus='unknown';
			}
			selectedBackupFile=null;
			validatedBackupData=null;
			backendValidationResult=null;
			importValidationError=null;
			importInProgress=false;
			map._frpsRestoreInlineStatus=restoreStatus;
			map.data.unload(map.config);
			return map.render().then(function(){
				if(typeof(map._frpsPostProcess)==='function')
					map._frpsPostProcess();
			});
		}).catch(function(e){
			var detail=e&&e.message?e.message:String(e);
			ss(_('Import failed: ')+detail,true);
		}).then(function(){
			importInProgress=false;
			updateImportButtonState();
		});
	}

	var expStatusEl = E('div',{style:'display:none;margin-top:8px;padding:8px 10px;border-radius:4px;font-size:13px;line-height:1.5;border:1px solid #e2e8f0;word-break:break-word'});


	return E('div',{style:'width:100%;max-width:940px;margin-left:0;margin-right:auto;font-size:.92rem;line-height:1.5'},[
		E('h4',{style:'margin:0 0 4px;font-size:1.05rem;font-weight:600'},_('Configuration Backup & Restore')),
		E('p',{style:'margin:0 0 10px;opacity:.78;font-size:.85rem'},_('Back up the current saved configuration or restore it from a backup file.')),
		E('style',{},'@media(max-width:900px){.frp-panel-grid{grid-template-columns:1fr!important}.frp-panel-right{border-left:0!important;border-top:1px solid #d1d5db!important}}'),
		E('div',{style:'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch;border:1px solid #d1d5db;border-radius:8px;overflow:hidden',class:'frp-panel-grid'},[
			E('div',{style:'padding:16px;display:flex;flex-direction:column'},[
				E('div',{style:'font-weight:600;font-size:.98rem;margin:0 0 2px'},_('Export Configuration')),
				E('div',{style:'font-size:.82rem;opacity:.72;margin:0 0 10px'},_('Export the current saved FRPS configuration as a JSON backup file.')),
				E('div',{style:'font-size:.82rem;opacity:.75;margin:0 0 10px;line-height:1.45'},[
					E('strong',{},_('Backup source')+': '),
					_('Current saved FRP configuration')
				]),
				E('div',{style:'margin-top:auto;padding-top:12px'},[
					E('button',{class:'cbi-button cbi-button-action',click:handleExport},_('Export Configuration')),
					expStatusEl
				])
			]),
			E('div',{style:'padding:16px;border-left:1px solid #d1d5db;display:flex;flex-direction:column',class:'frp-panel-right'},[
				E('div',{style:'font-weight:600;font-size:.98rem;margin:0 0 2px'},_('Import & Restore')),
				E('div',{style:'font-size:.82rem;opacity:.72;margin:0 0 10px'},_('Select a backup file. The router will validate it before restoring the configuration.')),
				E('div',{style:'display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 8px'},[
					fi,
					E('button',{type:'button',class:'cbi-button',click:function(){fi.click();}},_('Select Backup File'))
				]),
				stEl,
				E('div',{style:'margin-top:auto;padding-top:12px'},[
					E('button',{class:'cbi-button cbi-button-reset',id:'frp-import-btn',disabled:true,click:handleImport},_('Import & Restore'))
				])
			])
		]),
		E('div',{style:'border:1px solid #d1d5db;border-top:0;border-radius:0 0 8px 8px;padding:10px 16px;font-size:.78rem;opacity:.7;line-height:1.45'},HELP_TIP)
	]);
}
