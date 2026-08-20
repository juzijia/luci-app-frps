'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

/* Use the same OpenWrt log RPC consumed by LuCI's native system-log view. */
var callLogRead = rpc.declare({
	object: 'log',
	method: 'read',
	params: [ 'lines', 'stream', 'oneshot' ],
	expect: { log: [] }
});

/* Read the saved FRPS log level so historical system-log display follows it too. */
var callUciGet = rpc.declare({
	object: 'uci',
	method: 'get',
	params: [ 'config' ],
	expect: { values: {} }
});

var MAX_DISPLAY_LINES = 100;
var MAX_DISPLAY_CHARS = 12 * 1024;
var FETCH_SYSTEM_LINES = 500;
var FRP_LEVELS = {
	T: 'TRACE',
	D: 'DEBUG',
	I: 'INFO',
	W: 'WARN',
	E: 'ERROR'
};
var LOG_LEVEL_RANKS = {
	TRACE: 0,
	DEBUG: 1,
	INFO: 2,
	WARN: 3,
	ERROR: 4
};
var SYSLOG_LEVELS = [ 'EMERG', 'ALERT', 'CRIT', 'ERROR', 'WARN', 'NOTICE', 'INFO', 'DEBUG' ];

function stripAnsi(content) {
	return String(content || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function isFrpsDiagnostic(message) {
	message = String(message || '');
	return /^(?:frps(?:-advanced)?(?:\[\d+\])?):\s/.test(message) ||
		/^procd:\s.*\bfrps-advanced::/.test(message);
}

function entryTimeMs(entry) {
	if (!entry || entry.time == null)
		return null;
	var date = new Date(entry.time);
	var time = date.getTime();
	return isNaN(time) ? null : time;
}

function syslogLevel(entry) {
	var priority = Number(entry && entry.priority);
	if (!Number.isFinite(priority))
		return '';
	return SYSLOG_LEVELS[priority % 8] || '';
}

function canonicalLogLevel(level) {
	switch (String(level || '').toUpperCase()) {
	case 'TRACE':
		return 'TRACE';
	case 'DEBUG':
		return 'DEBUG';
	case 'NOTICE':
	case 'INFO':
		return 'INFO';
	case 'WARNING':
	case 'WARN':
		return 'WARN';
	case 'EMERG':
	case 'ALERT':
	case 'CRIT':
	case 'ERR':
	case 'ERROR':
		return 'ERROR';
	default:
		return '';
	}
}

function configuredLogLevel(res) {
	var values = res && res.values ? res.values : res;
	var main = values && values.main ? values.main : {};
	var level = canonicalLogLevel(main.log__level);
	return level || 'INFO';
}

function compactFrpsMessage(entry) {
	var message = stripAnsi(entry && entry.msg).trim();
	var level = '';
	var context = '';

	/* Keep service/procd diagnostics recognizable, but drop the volatile FRPS PID. */
	message = message.replace(/^frps\[\d+\]:\s*/, '');

	/* FRP prints its own timestamp after logd has already timestamped the entry. */
	message = message.replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\s*/, '');

	/* Preserve FRP severity, expanding the one-letter marker for readability. */
	var match = message.match(/^\[([TDIWE])\]\s*/);
	if (match) {
		level = FRP_LEVELS[match[1]] || '';
		message = message.slice(match[0].length);
	}

	/* Source file/line is useful for developers but too noisy for the LuCI runtime view. */
	match = message.match(/^\[[^\]]+\.go:\d+\]\s*/);
	if (match)
		message = message.slice(match[0].length);

	/* Drop FRP run/session ID; preserve a following proxy/client context when present. */
	match = message.match(/^\[([0-9a-f]{8,})\]\s*/i);
	if (match)
		message = message.slice(match[0].length);

	match = message.match(/^\[([^\]]+)\]\s*/);
	if (match) {
		context = '[' + match[1] + ']';
		message = message.slice(match[0].length);
	}

	if (!level)
		level = syslogLevel(entry);

	return {
		level: level,
		context: context,
		message: message
	};
}

function entryPassesLogLevel(entry, configuredLevel) {
	var compact = compactFrpsMessage(entry);
	var entryLevel = canonicalLogLevel(compact.level) || 'INFO';
	var threshold = canonicalLogLevel(configuredLevel) || 'INFO';
	return LOG_LEVEL_RANKS[entryLevel] >= LOG_LEVEL_RANKS[threshold];
}

function formatEntry(entry) {
	var compact = compactFrpsMessage(entry);
	var timeMs = entryTimeMs(entry);
	var parts = [];

	if (timeMs != null)
		parts.push('[' + new Date(timeMs).toLocaleString() + ']');
	if (compact.level)
		parts.push('[' + compact.level + ']');
	if (compact.context)
		parts.push(compact.context);
	if (compact.message)
		parts.push(compact.message);

	return parts.join(' ');
}

function trimDisplay(lines) {
	if (!Array.isArray(lines))
		lines = [];
	if (lines.length > MAX_DISPLAY_LINES)
		lines = lines.slice(-MAX_DISPLAY_LINES);

	var content = lines.join('\n');
	if (content.length > MAX_DISPLAY_CHARS) {
		content = content.slice(-MAX_DISPLAY_CHARS);
		var firstNewline = content.indexOf('\n');
		if (firstNewline >= 0)
			content = content.slice(firstNewline + 1);
	}
	return content;
}

function formatFrpsLog(entries, clearCutoff, configuredLevel) {
	var lines = [];
	entries = Array.isArray(entries) ? entries : [];

	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i] || {};
		var message = String(entry.msg || '');
		if (!isFrpsDiagnostic(message))
			continue;

		var timeMs = entryTimeMs(entry);
		if (clearCutoff != null && timeMs != null && timeMs <= clearCutoff)
			continue;

		/* Filter before display limits so hidden lower-level entries consume no quota. */
		if (!entryPassesLogLevel(entry, configuredLevel))
			continue;

		lines.push(formatEntry(entry));
	}

	return trimDisplay(lines);
}

function fetchLogs() {
	return L.resolveDefault(callLogRead(FETCH_SYSTEM_LINES, false, true), []);
}

function fetchLogLevel() {
	return L.resolveDefault(callUciGet('frps-advanced'), {}).then(configuredLogLevel);
}

function fetchLogState() {
	return Promise.all([ fetchLogs(), fetchLogLevel() ]);
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render() {
		var firstLoad = true;
		var clearCutoff = null;
		var logArea = E('textarea', {
			id: 'log_textarea',
			style: 'width:100%;min-height:460px;box-sizing:border-box;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;font-size:13px;line-height:1.6;padding:10px 12px;color:var(--text-color-high,var(--cbi-text,#1f2937));background-color:var(--background-color-high,#ffffff);',
			rows: '24',
			wrap: 'off',
			readonly: 'readonly'
		});

		function applyResult(state) {
			var entries = Array.isArray(state) ? state[0] : [];
			var configuredLevel = Array.isArray(state) ? state[1] : 'INFO';
			var content = formatFrpsLog(entries, clearCutoff, configuredLevel);
			if (content) {
				logArea.value = content;
			} else if (clearCutoff != null) {
				logArea.value = _('Log display cleared. New FRPS log entries will appear automatically.');
			} else {
				logArea.value = _('No FRPS log entries yet.');
			}

			if (firstLoad) {
				logArea.scrollTop = logArea.scrollHeight;
				firstLoad = false;
			}
		}

		var clearBtn = E('input', {
			class: 'cbi-button cbi-button-remove',
			type: 'button',
			id: 'clear_log_button',
			value: _('Clear Log'),
			click: ui.createHandlerFn(this, function() {
				clearCutoff = Date.now();
				logArea.value = _('Log display cleared. New FRPS log entries will appear automatically.');
				logArea.scrollTop = logArea.scrollHeight;
			})
		});

		var refreshBtn = E('input', {
			class: 'cbi-button cbi-button-reload',
			type: 'button',
			value: _('Refresh'),
			click: ui.createHandlerFn(this, function() {
				refreshBtn.disabled = true;
				firstLoad = true;
				return fetchLogState()
					.then(applyResult)
					.then(function() { refreshBtn.disabled = false; }, function() { refreshBtn.disabled = false; });
			})
		});

		poll.add(function() {
			return fetchLogState().then(applyResult);
		}, 5);

		return E('div', { class: 'cbi-map' }, [
			E('div', { class: 'cbi-section' }, [
				E('div', { class: 'frp-log-toolbar', style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:0;flex-wrap:wrap;' }, [
					E('span', { style: 'color:#6b7280;font-size:.9rem;' },
						_('Displays recent FRPS system logs, up to 100 lines or 12 KiB, refreshing every 5 seconds. Clear Log only clears this display.')),
					E('span', { style: 'display:flex;gap:8px;align-items:center;' }, [refreshBtn, clearBtn])
				]),
				logArea
			])
		]);
	}
});
