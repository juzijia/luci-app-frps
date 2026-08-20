'use strict';
'require view.frps_advanced_base as base';

/*
 * Compact presentation wrapper for the FRPS settings view.
 * Business logic stays in frps_advanced_base.js; this file only reshapes
 * rendered DOM and adds local inline SVG presentation assets.
 */

var compactStyleId = 'frps-compact-advanced-style';
var iconSpriteId = 'frps-inline-icon-sprite';
var compactApplying = false;
var SVG_NS = 'http://www.w3.org/2000/svg';
var XLINK_NS = 'http://www.w3.org/1999/xlink';

function compactText(en, zh) {
	var lang = '';
	try {
		lang = ((document.documentElement && document.documentElement.lang) || (L.env && L.env.lang) || '').toLowerCase();
	} catch (e) { }
	return lang.indexOf('zh') === 0 ? zh : en;
}

function svgNode(name, attrs) {
	var node = document.createElementNS(SVG_NS, name);
	attrs = attrs || {};
	for (var key in attrs) {
		if (Object.prototype.hasOwnProperty.call(attrs, key))
			node.setAttribute(key, attrs[key]);
	}
	return node;
}

var iconDefs = {
	activity: [
		['path', { d: 'M3 12h4l2-5 4 10 2-5h6' }]
	],
	route: [
		['circle', { cx: '5', cy: '6', r: '2' }],
		['circle', { cx: '19', cy: '6', r: '2' }],
		['circle', { cx: '12', cy: '18', r: '2' }],
		['path', { d: 'M7 6h10M6.5 7.5l4.3 8M17.5 7.5l-4.3 8' }]
	],
	shield: [
		['path', { d: 'M12 3l7 3v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3z' }],
		['path', { d: 'M12 8v6M12 17h.01' }]
	],
	lock: [
		['rect', { x: '6', y: '10', width: '12', height: '10', rx: '2' }],
		['path', { d: 'M9 10V7a3 3 0 016 0v3M12 14v2' }]
	],
	panel: [
		['rect', { x: '4', y: '4', width: '16', height: '13', rx: '2' }],
		['path', { d: 'M8 21h8M10 17v4M14 17v4M8 8h8M8 12h5' }]
	],
	radio: [
		['circle', { cx: '12', cy: '12', r: '2' }],
		['path', { d: 'M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.5 5.5a9 9 0 000 13M18.5 5.5a9 9 0 010 13' }]
	],
	nodes: [
		['circle', { cx: '12', cy: '5', r: '2' }],
		['circle', { cx: '5', cy: '12', r: '2' }],
		['circle', { cx: '19', cy: '12', r: '2' }],
		['circle', { cx: '12', cy: '19', r: '2' }],
		['path', { d: 'M10.5 6.5L6.5 10.5M13.5 6.5l4 4M6.5 13.5l4 4M17.5 13.5l-4 4' }]
	],
	server: [
		['rect', { x: '4', y: '4', width: '16', height: '6', rx: '2' }],
		['rect', { x: '4', y: '14', width: '16', height: '6', rx: '2' }],
		['path', { d: 'M8 7h.01M8 17h.01M12 7h6M12 17h6' }]
	],
	globe: [
		['circle', { cx: '12', cy: '12', r: '9' }],
		['path', { d: 'M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9S14.5 18.5 12 21M12 3C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9' }]
	],
	plug: [
		['path', { d: 'M8 3v5M16 3v5M6 8h12v2a6 6 0 01-6 6v5M9 21h6' }]
	],
	code: [
		['path', { d: 'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14' }]
	],
	certificate: [
		['rect', { x: '4', y: '3', width: '13', height: '17', rx: '2' }],
		['path', { d: 'M8 7h5M8 11h5M8 15h3' }],
		['circle', { cx: '18', cy: '16', r: '3' }],
		['path', { d: 'M16.5 18.5L16 22l2-1 2 1-.5-3.5' }]
	],
	users: [
		['circle', { cx: '9', cy: '8', r: '3' }],
		['path', { d: 'M3 20v-2a5 5 0 015-5h2a5 5 0 015 5v2M16 6a3 3 0 010 6M17 13a5 5 0 014 5v2' }]
	],
	key: [
		['circle', { cx: '8', cy: '12', r: '4' }],
		['path', { d: 'M12 12h9M17 12v3M20 12v2' }]
	],
	archive: [
		['rect', { x: '4', y: '5', width: '16', height: '15', rx: '2' }],
		['path', { d: 'M3 5h18V2H3v3M9 10h6M12 10v6M9.5 13.5L12 16l2.5-2.5' }]
	]
};

function ensureIconSprite() {
	if (document.getElementById(iconSpriteId) || !document.body) return;

	var sprite = svgNode('svg', {
		id: iconSpriteId,
		class: 'frps-icon-sprite',
		'aria-hidden': 'true',
		focusable: 'false'
	});

	for (var name in iconDefs) {
		if (!Object.prototype.hasOwnProperty.call(iconDefs, name)) continue;
		var symbol = svgNode('symbol', {
			id: 'frps-icon-' + name,
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		});
		var shapes = iconDefs[name];
		for (var i = 0; i < shapes.length; i++)
			symbol.appendChild(svgNode(shapes[i][0], shapes[i][1]));
		sprite.appendChild(symbol);
	}

	document.body.appendChild(sprite);
}

function makeIcon(name, className) {
	ensureIconSprite();
	var svg = svgNode('svg', {
		class: className || 'frps-icon',
		viewBox: '0 0 24 24',
		'aria-hidden': 'true',
		focusable: 'false',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': '1.8',
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round'
	});
	var use = svgNode('use');
	use.setAttribute('href', '#frps-icon-' + name);
	try { use.setAttributeNS(XLINK_NS, 'xlink:href', '#frps-icon-' + name); } catch (e) { }
	svg.appendChild(use);
	return svg;
}

function ensureCompactStyle() {
	if (document.getElementById(compactStyleId)) return;

	var css = [
		'.frps-icon-sprite{position:absolute!important;width:0!important;height:0!important;overflow:hidden!important;pointer-events:none!important}',
		'.frps-icon{display:inline-block;flex:0 0 auto;width:15px;height:15px;vertical-align:-2px;pointer-events:none;color:currentColor}',
		'.frps-tab-icon{width:17px;height:17px;stroke-width:1.8}',
		'.frps-card-icon,.frps-backup-icon{width:16px;height:16px;color:#53647f;stroke-width:2}',
		'.frps-advanced-root .cbi-tabmenu{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin:0 0 10px;padding:0 8px;border-bottom:1px solid #e5e7eb;background:rgba(255,255,255,.76)}',
		'.frps-advanced-root .cbi-tabmenu>li{margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}',
		'.frps-advanced-root .cbi-tabmenu>li>a{display:flex!important;align-items:center;gap:7px;padding:9px 12px 8px!important;border:0!important;border-bottom:2px solid transparent!important;background:transparent!important;color:#475569!important;font-weight:500;text-decoration:none!important}',
		'.frps-advanced-root .cbi-tabmenu>li.cbi-tab>a{color:#5267e9!important;border-bottom-color:#5b72f2!important;font-weight:600}',
		'.frps-advanced-root .cbi-tabmenu>li.cbi-tab>a .frps-tab-icon{color:#5267e9}',
		'.frps-advanced-root .frps-mode-bar{padding:0 12px;margin-bottom:8px}',
		'.frps-compact-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start;box-sizing:border-box;width:calc(100% - 16px);max-width:1400px;margin:8px 0 6px 8px}',
		'.frps-compact-card{min-width:0;overflow:hidden;border:1px solid #dbe2ea;border-radius:6px;background:rgba(255,255,255,.88);box-shadow:0 1px 2px rgba(15,23,42,.035)}',
		'.frps-compact-card-wide{grid-column:1/-1}',
		'.frps-compact-card-title{display:flex;align-items:center;gap:7px;min-height:34px;box-sizing:border-box;padding:0 11px;border-bottom:1px solid #e5eaf0;background:rgba(248,250,252,.88);font-size:.88rem;line-height:1.2;font-weight:600;color:#1f2937}',
		'.frps-compact-card-body{padding:3px 10px 5px}',
		'.frps-compact-card .cbi-value{box-sizing:border-box;margin:0!important;padding:6px 0!important;border:0!important;display:grid!important;grid-template-columns:minmax(118px,34%) minmax(0,1fr);column-gap:10px;align-items:start;width:100%;min-height:0!important}',
		'.frps-compact-card .cbi-value.hidden{display:none!important}',
		'.frps-ui-basic .frps-compact-card .frps-advanced-field{display:none!important}',
		'.frps-compact-card .cbi-value+.cbi-value{border-top:1px solid rgba(226,232,240,.64)!important}',
		'.frps-compact-card .cbi-value-title{box-sizing:border-box;width:auto!important;max-width:none!important;padding:5px 0 0!important;text-align:left!important;white-space:normal;line-height:1.28;font-size:.82rem;color:#25324a}',
		'.frps-compact-card .cbi-value-field{box-sizing:border-box;width:100%!important;max-width:none!important;min-width:0;padding:0!important}',
		'.frps-compact-card .cbi-value-description{max-width:380px!important;margin-top:2px!important;font-size:.71rem;line-height:1.3;color:#8a94aa}',
		'.frps-compact-card input[type=text],.frps-compact-card input[type=password],.frps-compact-card input[type=number],.frps-compact-card select{box-sizing:border-box;width:100%!important;max-width:360px!important;min-height:29px!important}',
		'.frps-compact-card .cbi-dropdown{box-sizing:border-box;width:100%!important;max-width:360px!important;min-height:29px!important}',
		'.frps-compact-card input[type=checkbox]{margin-top:4px}',
		'.frps-compact-card-wide .frps-compact-card-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:18px;row-gap:0;padding:3px 10px 5px}',
		'.frps-compact-card-wide .cbi-value{grid-template-columns:minmax(128px,150px) minmax(0,1fr);column-gap:10px;border-top:0!important}',
		'.frps-compact-card-wide .cbi-value:nth-child(n+3){border-top:1px solid rgba(226,232,240,.64)!important}',
		'.frps-compact-card-wide .cbi-value-description.frps-compact-wide-description{grid-column:2;margin:2px 0 0!important;align-self:start;max-width:360px!important}',
		'.frps-compact-card[data-frps-card=controls] .cbi-value-field,.frps-compact-card[data-frps-card=monitoring] .cbi-value-field{padding-top:0!important}',
		'.frps-compact-card[data-frps-card=controls] .cbi-value,.frps-compact-card[data-frps-card=monitoring] .cbi-value{grid-template-columns:minmax(150px,44%) minmax(0,1fr)}',
		'.frps-compact-card[data-frps-card=raw-toml] input[type=text],.frps-compact-card[data-frps-card=raw-toml] .cbi-dynlist{max-width:100%!important}',
		'.frps-backup-module{box-sizing:border-box;width:calc(100% - 16px)!important;max-width:1400px!important;margin:8px 0 6px 8px!important;border:1px solid #dbe2ea;border-radius:6px;background:rgba(255,255,255,.88);overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.035)}',
		'.frps-backup-module>h4:first-child{display:flex;align-items:center;gap:7px;min-height:34px;box-sizing:border-box;margin:0!important;padding:0 11px!important;border-bottom:1px solid #e5eaf0;background:rgba(248,250,252,.88);font-size:.88rem!important;line-height:1.2;font-weight:600!important;color:#1f2937}',
		'.frps-backup-module>p:nth-child(2){margin:0!important;padding:7px 11px!important;border-bottom:1px solid #e5eaf0;font-size:.76rem!important;line-height:1.35!important;color:#64748b;opacity:1!important}',
		'.frps-backup-module .frp-panel-grid{border:0!important;border-radius:0!important}',
		'.frps-backup-module .frp-panel-grid>div{padding:12px!important}',
		'.frps-backup-module .frp-panel-grid+div{border:0!important;border-top:1px solid #e5eaf0!important;border-radius:0!important;padding:8px 11px!important;background:rgba(248,250,252,.55);font-size:.75rem!important;opacity:.78!important}',
		'@media(min-width:1500px){.frps-compact-layout,.frps-backup-module{max-width:1360px!important}.frps-compact-card .cbi-value-description{font-size:.7rem}}',
		'@media(max-width:1050px){.frps-compact-layout{width:calc(100% - 10px)}.frps-compact-card-wide .frps-compact-card-body{grid-template-columns:1fr}.frps-compact-card-wide .cbi-value:nth-child(n+2){border-top:1px solid rgba(226,232,240,.64)!important}.frps-compact-card-wide .cbi-value{grid-template-columns:minmax(130px,34%) minmax(0,1fr)}.frps-compact-card-wide .cbi-value-description.frps-compact-wide-description{grid-column:2}}',
		'@media(max-width:900px){.frps-compact-layout{grid-template-columns:1fr;gap:8px;width:100%;margin:6px 0}.frps-backup-module{width:100%!important;margin:6px 0!important}.frps-compact-card-wide{grid-column:auto}.frps-advanced-root .cbi-tabmenu{padding:0 4px}.frps-advanced-root .cbi-tabmenu>li>a{padding:8px 8px 7px!important}.frps-compact-card input[type=text],.frps-compact-card input[type=password],.frps-compact-card input[type=number],.frps-compact-card select,.frps-compact-card .cbi-dropdown{max-width:100%!important}}',
		'@media(max-width:620px){.frps-compact-card .cbi-value,.frps-compact-card-wide .cbi-value{grid-template-columns:1fr;row-gap:3px}.frps-compact-card .cbi-value-title{padding-top:1px!important}.frps-compact-card-body,.frps-compact-card-wide .frps-compact-card-body{padding:3px 8px 5px}.frps-compact-card-wide .cbi-value-description.frps-compact-wide-description{grid-column:1}.frps-compact-card-title{padding:0 9px}.frps-tab-icon{width:15px;height:15px}}'
	].join('');

	document.head.appendChild(E('style', { id: compactStyleId, type: 'text/css' }, css));
}

function findRow(root, name) {
	return root.querySelector('[id$="-' + name + '"]');
}

function findTabHost(root, firstRow, tabName, rows) {
	var node = firstRow ? firstRow.parentElement : null;
	while (node && node !== root) {
		var containsAll = true;
		for (var i = 0; i < rows.length; i++) {
			if (!node.contains(rows[i])) { containsAll = false; break; }
		}
		if (containsAll) {
			var tab = node.getAttribute && node.getAttribute('data-tab');
			if (tab === tabName || (node.classList && node.classList.contains('cbi-tabcontainer')))
				return node;
		}
		node = node.parentElement;
	}

	var common = firstRow ? firstRow.parentElement : null;
	while (common && common !== root) {
		var ok = true;
		for (var j = 0; j < rows.length; j++) {
			if (!common.contains(rows[j])) { ok = false; break; }
		}
		if (ok) return common;
		common = common.parentElement;
	}
	return firstRow ? firstRow.parentElement : null;
}

function directChildUnder(node, ancestor) {
	var current = node;
	while (current && current.parentElement && current.parentElement !== ancestor)
		current = current.parentElement;
	return current;
}

function makeCard(root, spec) {
	var rows = [];
	for (var i = 0; i < spec.fields.length; i++) {
		var row = findRow(root, spec.fields[i]);
		if (row) rows.push(row);
	}
	if (!rows.length) return null;

	var body = E('div', { class: 'frps-compact-card-body' });
	for (var r = 0; r < rows.length; r++) {
		if (spec.wide) {
			var field = rows[r].querySelector('.cbi-value-field');
			var desc = field && field.querySelector('.cbi-value-description');
			if (desc && desc.parentElement === field) {
				desc.classList.add('frps-compact-wide-description');
				rows[r].appendChild(desc);
			}
		}
		body.appendChild(rows[r]);
	}

	return E('section', {
		class: 'frps-compact-card' + (spec.wide ? ' frps-compact-card-wide' : ''),
		'data-frps-card': spec.key
	}, [
		E('div', { class: 'frps-compact-card-title' }, [
			makeIcon(spec.icon, 'frps-icon frps-card-icon'),
			E('span', {}, compactText(spec.en, spec.zh))
		]),
		body
	]);
}

function buildLayout(root, tabName, specs) {
	if (root.querySelector('.frps-compact-layout[data-frps-tab="' + tabName + '"]')) return;

	var allRows = [];
	for (var s = 0; s < specs.length; s++) {
		for (var f = 0; f < specs[s].fields.length; f++) {
			var row = findRow(root, specs[s].fields[f]);
			if (row && allRows.indexOf(row) < 0) allRows.push(row);
		}
	}
	if (!allRows.length) return;

	var firstRow = allRows[0];
	var host = findTabHost(root, firstRow, tabName, allRows);
	if (!host) return;
	for (var i = 0; i < allRows.length; i++) {
		if (!host.contains(allRows[i])) return;
	}

	var anchor = directChildUnder(firstRow, host);
	var layout = E('div', { class: 'frps-compact-layout', 'data-frps-tab': tabName });
	if (anchor && anchor.parentElement === host) host.insertBefore(layout, anchor);
	else host.appendChild(layout);

	for (var c = 0; c < specs.length; c++) {
		var card = makeCard(root, specs[c]);
		if (card) layout.appendChild(card);
	}
	if (!layout.children.length) layout.remove();
}

function decorateTabs(root) {
	var specs = [
		{ tab: 'run', icon: 'activity', en: 'Run & Logs', zh: '运行与日志' },
		{ tab: 'network', icon: 'route', en: 'Listen & Routing', zh: '监听与路由' },
		{ tab: 'security', icon: 'lock', en: 'Authentication & TLS', zh: '认证与 TLS' },
		{ tab: 'dashboard', icon: 'panel', en: 'Dashboard', zh: '管理面板' },
		{ tab: 'performance', icon: 'radio', en: 'Transport & Limits', zh: '传输与限制' },
		{ tab: 'advanced', icon: 'nodes', en: 'Extensions', zh: '拓展功能' }
	];
	var items = root.querySelectorAll('.cbi-tabmenu > li');
	for (var i = 0; i < items.length; i++) {
		var li = items[i];
		var anchor = li.querySelector('a');
		if (!anchor || anchor.querySelector('.frps-tab-icon')) continue;
		var tab = li.getAttribute('data-tab') || anchor.getAttribute('data-tab') || '';
		var text = (anchor.textContent || '').trim();
		var match = null;
		for (var s = 0; s < specs.length; s++) {
			if (tab === specs[s].tab || text === specs[s].en || text === specs[s].zh || text === compactText(specs[s].en, specs[s].zh)) {
				match = specs[s];
				break;
			}
		}
		if (match)
			anchor.insertBefore(makeIcon(match.icon, 'frps-icon frps-tab-icon'), anchor.firstChild);
	}
}

function styleBackupRestore(root) {
	var importButton = root.querySelector('#frp-import-btn');
	if (!importButton) return;
	var panel = importButton.closest ? importButton.closest('.frp-panel-grid') : null;
	var widget = panel && panel.parentElement;
	if (!widget || !widget.classList) return;
	widget.classList.add('frps-backup-module');
	var heading = widget.querySelector('h4');
	if (heading && !heading.querySelector('.frps-backup-icon'))
		heading.insertBefore(makeIcon('archive', 'frps-icon frps-backup-icon'), heading.firstChild);
}

function logicallyVisible(row, basic) {
	if (!row || row.hidden || row.classList.contains('hidden')) return false;
	if (basic && row.classList.contains('frps-advanced-field')) return false;
	return true;
}

function refreshCards(root) {
	if (!root || !root.querySelectorAll) return;
	var form = root.querySelector('.cbi-map');
	var basic = !!(form && form.classList.contains('frps-ui-basic'));
	var cards = root.querySelectorAll('.frps-compact-card');
	for (var i = 0; i < cards.length; i++) {
		var rows = cards[i].querySelectorAll('.cbi-value');
		var visible = false;
		for (var r = 0; r < rows.length; r++) {
			if (logicallyVisible(rows[r], basic)) { visible = true; break; }
		}
		cards[i].style.display = visible ? '' : 'none';
	}

	var layouts = root.querySelectorAll('.frps-compact-layout');
	for (var l = 0; l < layouts.length; l++) {
		var layoutCards = layouts[l].querySelectorAll('.frps-compact-card');
		var shown = false;
		for (var k = 0; k < layoutCards.length; k++) {
			if (layoutCards[k].style.display !== 'none') { shown = true; break; }
		}
		layouts[l].style.display = shown ? 'grid' : 'none';
	}
}

function applyCompactPanels(root) {
	if (!root || compactApplying) return;
	compactApplying = true;
	try {
		ensureCompactStyle();
		ensureIconSprite();
		decorateTabs(root);

		buildLayout(root, 'run', [
			{ key: 'service-runtime', icon: 'server', en: 'Service runtime', zh: '服务运行', fields: ['enabled', 'client_file', 'run_user'] },
			{ key: 'logging-recovery', icon: 'activity', en: 'Logging & recovery', zh: '日志与自恢复', fields: ['log__level', 'respawn'] }
		]);

		buildLayout(root, 'network', [
			{ key: 'core-listen', icon: 'route', en: 'Control & proxy listeners', zh: '控制与代理监听', fields: ['bindAddr', 'bindPort', 'proxyBindAddr'] },
			{ key: 'udp-listen', icon: 'radio', en: 'UDP listeners', zh: 'UDP 监听', fields: ['kcpBindPort', 'quicBindPort'] },
			{ key: 'vhost-route', icon: 'globe', en: 'Virtual host & routing', zh: '虚拟主机与路由', fields: ['vhostHTTPPort', 'vhostHTTPTimeout', 'vhostHTTPSPort', 'subDomainHost', 'custom404Page'] },
			{ key: 'tcpmux-route', icon: 'plug', en: 'TCPMux', zh: 'TCPMux', fields: ['tcpmuxHTTPConnectPort', 'tcpmuxPassthrough'] }
		]);

		buildLayout(root, 'security', [
			{ key: 'auth', icon: 'shield', en: 'Authentication', zh: '认证', fields: ['auth__method', 'auth__token', 'auth__tokenSource__file__path', 'auth__additionalScopes', 'auth__oidc__issuer', 'auth__oidc__audience', 'auth__oidc__skipExpiryCheck', 'auth__oidc__skipIssuerCheck'] },
			{ key: 'controls', icon: 'lock', en: 'TLS control connection', zh: 'TLS 控制连接', fields: ['transport__tls__force', 'detailedErrorsToClient'] },
			{ key: 'tls', icon: 'certificate', en: 'TLS certificates & verification', zh: 'TLS 证书与校验', wide: true, fields: ['transport__tls__certFile', 'transport__tls__keyFile', 'transport__tls__trustedCaFile', 'transport__tls__serverName'] }
		]);

		buildLayout(root, 'dashboard', [
			{ key: 'access', icon: 'panel', en: 'Panel access', zh: '面板访问', fields: ['webServer__addr', 'webServer__port', 'webServer__user', 'webServer__password'] },
			{ key: 'monitoring', icon: 'code', en: 'Debug & monitoring', zh: '调试与监控', fields: ['enablePrometheus', 'webServer__pprofEnable', 'webServer__assetsDir'] },
			{ key: 'dashboard-tls', icon: 'lock', en: 'Dashboard TLS', zh: '面板 TLS', wide: true, fields: ['webServer__tls__certFile', 'webServer__tls__keyFile', 'webServer__tls__trustedCaFile', 'webServer__tls__serverName'] }
		]);

		buildLayout(root, 'performance', [
			{ key: 'connection', icon: 'plug', en: 'Connection multiplexing & keepalive', zh: '连接复用与保活', fields: ['transport__tcpMux', 'transport__tcpMuxKeepaliveInterval', 'transport__tcpKeepalive', 'transport__maxPoolCount', 'transport__heartbeatTimeout', 'userConnTimeout'] },
			{ key: 'quic', icon: 'globe', en: 'QUIC & UDP', zh: 'QUIC 与 UDP', fields: ['transport__quic__keepalivePeriod', 'transport__quic__maxIdleTimeout', 'transport__quic__maxIncomingStreams', 'udpPacketSize'] },
			{ key: 'ports', icon: 'shield', en: 'Port limits', zh: '端口限制', fields: ['maxPortsPerClient', 'allowPorts'] },
			{ key: 'nat', icon: 'users', en: 'NAT & resource limits', zh: 'NAT 与资源限制', fields: ['natholeAnalysisDataReserveHours'] }
		]);

		buildLayout(root, 'advanced', [
			{ key: 'ssh-gateway', icon: 'key', en: 'SSH tunnel gateway', zh: 'SSH 隧道网关', fields: ['sshTunnelGateway__bindPort', 'sshTunnelGateway__privateKeyFile', 'sshTunnelGateway__autoGenPrivateKeyPath', 'sshTunnelGateway__authorizedKeysFile'] },
			{ key: 'raw-toml', icon: 'code', en: 'Raw TOML options', zh: '原始 TOML 选项', fields: ['extra_setting'] }
		]);

		styleBackupRestore(root);
		refreshCards(root);
	} finally {
		compactApplying = false;
	}
}

function observeCompactRoot(root) {
	if (!root || root.__frpsCompactObserver) return;
	var timer = null;
	root.__frpsCompactObserver = new MutationObserver(function() {
		if (compactApplying) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(function() {
			timer = null;
			applyCompactPanels(root);
		}, 0);
	});
	root.__frpsCompactObserver.observe(root, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class', 'hidden']
	});
}

function attachCompactRoot() {
	var root = document.querySelector('#view .frps-advanced-root') || document.querySelector('.frps-advanced-root');
	if (!root) return false;
	applyCompactPanels(root);
	observeCompactRoot(root);
	return true;
}

/*
 * The required base module is a LuCI View instance. Requiring it starts the
 * single real View lifecycle. This wrapper must therefore return a constructor
 * without starting a second lifecycle; it only attaches the compact DOM layer
 * once the base view has rendered.
 */
return base.constructor.extend({
	__init__: function() {
		if (attachCompactRoot()) return;

		var host = document.getElementById('view') || document.body;
		if (!host) return;

		var bootstrapObserver = new MutationObserver(function() {
			if (attachCompactRoot())
				bootstrapObserver.disconnect();
		});
		bootstrapObserver.observe(host, { childList: true, subtree: true });
	}
});