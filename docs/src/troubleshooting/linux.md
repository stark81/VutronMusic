---
last-updated: 2026-07-08
title: Linux 平台问题
order: 3
---

# Linux 平台问题

Linux 桌面用户通常技术能力较强，但也期望应用能与桌面环境深度集成。VutronMusic 在 Linux 上的核心集成点是 **MPRIS**（Media Player Remote Interfacing Specification），它是 Linux 桌面统一媒体控制的标准。

## 常见问题

### MPRIS 不工作

**症状**：键盘上的多媒体键（播放/暂停/下一首）无法控制 VutronMusic。

**原因**：

- D-Bus 服务未正确注册
- 系统缺少 MPRIS 支持

**解决方案**：

1. 确认系统支持 MPRIS：
   ```bash
   # 运行后测试媒体键
   qdbus org.mpris.MediaPlayer2.VutronMusic /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.PlayPause
   ```
2. 重启 VutronMusic
3. 检查是否被其他应用抢占 MPRIS 服务（如浏览器、Spotify）

### GNOME Shell 扩展推荐

VutronMusic 在 GNOME 桌面上可以通过以下扩展在顶栏显示歌词和控制信息：

| 扩展 | 说明 |
| --- | --- |
| [media-controls](https://github.com/stark81/media-controls) | 显示媒体控制和歌词 |
| [dynamic-music-pill](https://extensions.gnome.org/extension/9334/dynamic-music-pill/) | 顶栏动态歌词显示 |

### KDE Plasma 扩展

| 扩展 | 说明 |
| --- | --- |
| [vutronmusic-lyrics](http://github.com/cmachsocket/org.kde.plasma.vutronmusic-lyrics) | KDE Plasma 上的歌词小部件 |

### 权限问题

**症状**：无法扫描本地音乐目录。

**原因**：某些目录（如 `/home/username/Music`）的权限不足。

**解决方案**：

- 确认 VutronMusic 有读取目标目录的权限
- 对于 Flatpak/Snap 版本，需要授予文件系统访问权限

### 显示缩放

**症状**：界面在高 DPI 显示器上显示过小或模糊。

**解决方案**：

- 在启动时添加环境变量：`ELECTRON_FORCE_SCALE=1.25 vutron-music`
- 或使用 `--force-device-scale-factor=1.25` 参数

---

## 开发环境

在 Linux 上开发 VutronMusic 需要：

```bash
# 安装依赖（Ubuntu/Debian）
sudo apt install build-essential libtag1-dev libtagc0-dev

# 运行
yarn dev
```

---

## 获取帮助

- 在 GitHub Issue 中带上系统信息：`uname -a` 和 `cat /etc/os-release`
- 描述使用的桌面环境和 Linux 发行版
