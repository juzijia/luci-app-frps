'use strict';
'require view';
'require form';

const pluginRequiredArmed = new Map();

function isPluginRequiredArmed(sectionId) {
	return pluginRequiredArmed.get(sectionId) === true;
}

return view.extend({
	render() {
		var m, s, o;

		m = new form.Map('frps-advanced');

		s = m.section(form.GridSection, 'http_plugin', _('HTTP Server Plugins'),
			_('Configure external HTTP services that frps calls during proxy events. These services must be deployed separately.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.addbtntitle = _('New HTTP plugin');
		s.modaltitle = _('HTTP Plugin');
		const pluginGrid = s;

		s.sectiontitle = function(section_id) {
			var uci = this.map.data.get('frps-advanced', section_id);
			return (uci && uci.name) ? uci.name : _('New HTTP plugin');
		};

		o = s.option(form.Value, 'name', _('Plugin instance name'),
			_('Required and must be unique among plugins, e.g. user-manager.'));
		o.optional = true;
		o.validate = function(section_id, value) {
			if (!value) {
				if (isPluginRequiredArmed(section_id))
					return _('Plugin instance name is required.');
				return true;
			}
			try {
				var sections = this.section.map.data.sections('frps-advanced', 'http_plugin');
				for (var i = 0; i < sections.length; i++) {
					if (sections[i]['.name'] !== section_id && sections[i].name === value)
						return _('Plugin instance name already exists.');
				}
			} catch (e) { }
			return true;
		};

		o = s.option(form.Value, 'addr', _('Plugin service address'),
			_('Required; external HTTP plugin listen address, e.g. 127.0.0.1:9000.'));
		o.optional = true;
		o.validate = function(section_id, value) {
			if (!value)
				return isPluginRequiredArmed(section_id) ? _('Plugin service address is required.') : true;
			return true;
		};

		o = s.option(form.Value, 'path', _('Request path'),
			_('Required; HTTP path frps uses when calling the plugin, e.g. /handler.'));
		o.placeholder = '/handler';
		o.optional = true;
		o.validate = function(section_id, value) {
			if (!value)
				return isPluginRequiredArmed(section_id) ? _('Request path is required.') : true;
			return true;
		};

		o = s.option(form.MultiValue, 'ops', _('Handled events'),
			_('At least one required. Can intercept Login, NewProxy, CloseProxy, Ping, NewWorkConn, and NewUserConn events.'));
		o.value('Login', 'Login');
		o.value('NewProxy', 'NewProxy');
		o.value('CloseProxy', 'CloseProxy');
		o.value('Ping', 'Ping');
		o.value('NewWorkConn', 'NewWorkConn');
		o.value('NewUserConn', 'NewUserConn');
		o.optional = true;
		o.rmempty = true;
		o.validate = function(section_id, value) {
			if (!value || value.length === 0)
				return isPluginRequiredArmed(section_id) ? _('At least one event is required.') : true;
			return true;
		};

		o = s.option(form.Flag, 'tlsVerify', _('TLS verification'),
			_('Verify the plugin HTTPS certificate; only meaningful when the plugin address uses HTTPS.'));
		o.enabled = 'true';
		o.disabled = 'false';

		const renderPluginModal = pluginGrid.renderMoreOptionsModal;
		pluginGrid.renderMoreOptionsModal = function(sectionId) {
			pluginRequiredArmed.delete(sectionId);
			return renderPluginModal.apply(this, arguments);
		};

		const cancelPluginModal = pluginGrid.handleModalCancel;
		pluginGrid.handleModalCancel = function(modalMap) {
			const sectionId = modalMap && modalMap.section;
			if (sectionId)
				pluginRequiredArmed.delete(sectionId);
			return cancelPluginModal.apply(this, arguments);
		};

		const savePluginModal = pluginGrid.handleModalSave;
		pluginGrid.handleModalSave = function(modalMap) {
			const sectionId = modalMap && modalMap.section;
			if (sectionId)
				pluginRequiredArmed.set(sectionId, true);
			return Promise.resolve(savePluginModal.apply(this, arguments)).then(function(result) {
				if (sectionId)
					pluginRequiredArmed.delete(sectionId);
				return result;
			});
		};

		return m.render();
	}
});
