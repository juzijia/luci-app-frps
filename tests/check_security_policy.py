"""Check the core-path and ACL contracts without executing OpenWrt services."""

import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
init = (root / 'root/etc/init.d/frps-advanced').read_text(encoding='utf-8')
rpc = (root / 'root/usr/libexec/rpcd/luci.frps-advanced').read_text(encoding='utf-8')
view = (root / 'htdocs/luci-static/resources/view/frps_advanced_base.js').read_text(encoding='utf-8')
core = re.search(r'^DEFAULT_CLIENT_FILE="([^"]+)"$', init, re.M).group(1)
assert core == '/usr/bin/frps'
assert re.search(r"const DEFAULT_CLIENT_FILE = '([^']+)';", rpc).group(1) == core
field = next(line for line in view.splitlines() if "[form.Value, 'client_file'" in line)
assert re.search(r"default: '([^']+)'", field).group(1) == core
assert 'client_file:or(\\"$DEFAULT_CLIENT_FILE\\"):$DEFAULT_CLIENT_FILE' in init
assert 'procd_set_param command "$DEFAULT_CLIENT_FILE"' in init
assert '"$DEFAULT_CLIENT_FILE" verify -c' in init
version = rpc.split('get_version: {', 1)[1]
assert 'path != DEFAULT_CLIENT_FILE' in version
assert 'command: DEFAULT_CLIENT_FILE' in version
validator = init.split('client_file_validate() {', 1)[1].split('\n}', 1)[0]
assert 'chmod' not in validator

acl = json.loads((root / 'root/usr/share/rpcd/acl.d/luci-app-frps-advanced.json').read_text())['luci-app-frps-advanced']
assert not acl['read'].get('uci')
assert set(acl['write']['uci']['frps-advanced']) == {'read', 'write'}
restricted = {'get_config', 'get_config_compare', 'get_version'}
assert restricted.isdisjoint(acl['read']['ubus']['luci.frps-advanced'])
assert {'get_version', 'get_config_compare'} <= set(acl['write']['ubus']['luci.frps-advanced'])
assert 'get_config: {' not in rpc
print('FRPS security policy static checks passed')
