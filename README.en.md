# luci-app-frps

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/juzijia/luci-app-frps?color=brightgreen)](https://github.com/juzijia/luci-app-frps/releases)

> **English** | [简体中文](README.md)

A LuCI management interface for FRPS on OpenWrt / ImmortalWrt.

This is a LuCI management interface and OpenWrt / ImmortalWrt integration project, not a fork or redistribution of FRP Core. This project does not include or distribute FRP Core; obtain FRP Core from the [official FRP repository (fatedier/frp)](https://github.com/fatedier/frp).

## Interface Preview

![FRPS LuCI management interface](docs/screenshots/frps.png)

## Installation

This project provides the LuCI management interface and does not include or distribute the FRPS Core binary.

Download from [Releases](https://github.com/juzijia/luci-app-frps/releases):

- `luci-app-frps-advanced_*.ipk`
- `luci-i18n-frps-advanced-zh-cn_*.ipk`

```sh
opkg install luci-app-frps-advanced_*.ipk
opkg install luci-i18n-frps-advanced-zh-cn_*.ipk
```

## Notes

- LuCI package architecture: `all`
- FRPS Core and the LuCI interface are decoupled
- Intended for OpenWrt / ImmortalWrt

## License

Licensed under the [MIT License](LICENSE).
