<div align="center">
  <a href="https://github.com/stark81/VutronMusic" target="blank">
    <img src="buildAssets/icons/icon.png" alt="Logo" width="156" height="156">
  </a>
  <h2  style="font-weight: 600">VutronMusic</h2>
  <p>高颜值的第三方网易云播放器</p>
</div>

[![LocalMusic][localMusic-screenShot]](https://github.com/stark81/VutronMusic)

## 说明

- 本项目为本人个人项目，仅用于个人学习研究，请勿用于商业用途。
- 本项目大部份界面和功能参考 [YesPlayMusic](https://github.com/qier222/YesPlayMusic)，侧边导航栏设计参考"方格音乐"，本地音乐top部分的信息统计参考 [NSMusicS](https://github.com/Super-Badmen-Viper/NSMusicS)。
- 本地歌曲的内嵌歌词以及外挂lrc歌词支持从[LDDC](https://github.com/chenmozhijin/LDDC)下载的逐字歌词歌词格式。

- 账号登录问题可以从 [wiki - 账号登陆](https://github.com/stark81/VutronMusic/wiki/%E8%B4%A6%E5%8F%B7%E7%99%BB%E9%99%86) 里查看解决方法。此外，[wiki](https://github.com/stark81/VutronMusic/wiki/) 里也包含了linux插件、逐字歌词、流媒体等方面的简要说明。

## 特点

- ⚡️ 手脚架为：[vutron](https://github.com/jooy2/vutron)；
- ⚡️ 使用 Vue3 + ts + pinia + fastify + better-sqlite3 进行开发；
- ⚡️ 支持本地歌曲、离线歌单功能，本地歌曲支持读取外挂和内嵌封面歌词，支持逐字歌词功能，支持线上信息匹配；
- ⚡️ 支持流媒体音乐，暂时包括：navidrome、jellyfin和emby；
- ⚡️ 支持Mac状态栏歌词、TouchBar歌词等；Linux下可通过[media-controls](https://github.com/stark81/media-controls)插件(gnome桌面)或者[vutronmusic-lyrics](http://github.com/cmachsocket/org.kde.plasma.vutronmusic-lyrics)插件(kde桌面)将歌词显示在TopBar里；
- ⚡️ 支持音效设置、变调变速等高级音频功能；
- ⚡️ 支持云盘、歌曲评论等功能；

## 配置开发环境

```
# 安装依赖，建议使用node21 + python3.9,其他的python版本可能会导致依赖安装失败的问题；
yarn install

# 运行
yarn run dev（开发）
yarn run build（构建）
```

## 开源许可

本项目仅供个人学习研究使用，禁止用于商业及非法用途。

基于 [MIT license](https://opensource.org/licenses/MIT) 许可进行开源。

## 截图

![home-screenShot][home-screenShot] ![explore-screenShot][explore-screenShot] ![library-screenShot][library-screenShot] ![likepage-screenShot][likepage-screenShot] ![local-music-screenShot][local-music-screenShot] ![playlist-screenShot][playlist-screenShot] ![playpage-screenShot][playpage-screenShot] ![comment-screenShot][comment-screenShot] ![search-screenShot][search-screenShot] ![user-screenShot][user-screenShot] ![mv-screenShot][mv-screenShot] ![tray-lyric-screenShot][tray-lyric-screenShot] ![media-controls-screenShot][media-controls-screenShot]

[localMusic-screenShot]: images/localMusic.jpg
[home-screenShot]: images/home.jpg
[explore-screenShot]: images/explore.jpg
[library-screenShot]: images/library.jpg
[likepage-screenShot]: images/like-page.jpg
[local-music-screenShot]: images/local-music.jpg
[playlist-screenShot]: images/playlists.jpg
[playpage-screenShot]: images/play-page.jpg
[comment-screenShot]: images/comment-page.jpg
[search-screenShot]: images/search-lyric.jpg
[setConvolver-screenShot]: images/setConvolver.jpg
[user-screenShot]: images/user.jpg
[tray-lyric-screenShot]: images/tray-TouchBar-lyric.jpg
[mv-screenShot]: images/mv.jpg
[media-controls-screenShot]: images/media-control-lyric.png
