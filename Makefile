# This is free software, licensed under the MIT License.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Advanced LuCI support for Frp server (JS v2)
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +ucode-mod-fs +ucode-mod-ubus +ucode-mod-uci
LUCI_PKGARCH:=all
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

define Package/luci-app-frps-advanced/conffiles
/etc/config/frps-advanced
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
