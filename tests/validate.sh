#!/usr/bin/env bash
set -euo pipefail

find htdocs -type f -name '*.js' -print0 | xargs -0 -r -n1 node --check

python3 - <<'PY'
import json
from pathlib import Path

for path in Path('root').rglob('*.json'):
    json.loads(path.read_text(encoding='utf-8'))
PY

sh -n root/etc/init.d/frps-advanced
sh -n root/etc/uci-defaults/40_luci-frps-advanced
bash -n tests/validate.sh

test -s root/usr/libexec/rpcd/luci.frps-advanced
test -x root/usr/libexec/rpcd/luci.frps-advanced
test -s root/usr/share/rpcd/acl.d/luci-app-frps-advanced.json

python3 tests/check_security_policy.py

PKG_VERSION="$(sed -n 's/^PKG_VERSION:=//p' Makefile)"
PKG_RELEASE="$(sed -n 's/^PKG_RELEASE:=//p' Makefile)"

[[ "$PKG_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
[[ "$PKG_RELEASE" =~ ^[0-9]+$ ]]

test -s po/templates/frps-advanced.pot
test -s po/zh_Hans/frps-advanced.po
