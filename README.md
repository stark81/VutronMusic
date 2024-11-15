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
- 由于本人对better-sqlite3不是那么熟悉，现在即便是安装依赖文件后自动运行post-install，也会导致better-sqlite3没有被准确复制，从而使得安装依赖文件后的第一次运行/打包失败，此时只需再次运行项目，即可正常使用<b> (此时， dist-native目录下会出现better-sqlite3文件)</b>。
- 本项目大部份界面和功能参考 [YesPlayMusic](https://github.com/qier222/YesPlayMusic)，侧边导航栏设计参考"方格音乐"，本地音乐top部分的信息统计参考 [NSMusicS](https://github.com/Super-Badmen-Viper/NSMusicS)。
- 为了减少内存使用，本项目使用虚拟列表来显示绝大部分的列表内容，包括：歌曲列表(单列、固定高度)、评论列表(单列、不固定高度、数量会增减)、探索页面的歌单、歌手列表(多列、不固定高度、数量会增减)等，因此部分列表滚动时可能会发生跳动、闪烁等现象，这些问题还在研究和处理。

## 特点

- ⚡️ 使用 Vue3 + ts + pinia + fastify + better-sqlite3 进行开发；
- ⚡️ 支持本地歌曲、离线歌单功能，本地歌曲支持读取内嵌封面、内嵌歌词功能，支持线上信息匹配(使用的是匹配接口，非搜索接口)；
- ⚡️ 支持Mac状态栏歌词、TouchBar歌词等；
- ⚡️ 支持云盘、歌曲评论等功能；

## 配置开发环境

```
# 安装依赖
yarn install  # Windows用户安装依赖时可能会报better-sqlite3的pre-build错误，不用理会

# Linux用户
   本项目使用的electron版本为^33.0.0, 但Linux用户在安装该版本依赖时可能会报electron/node-gyp相关的错误，如果出现此错误的话，请手动修改package.json中的electron版本为~32.0.0，然后重新安装依赖即可；

# Windows用户创建本地环境变量
  cp .env.example .env
  - 同时将 dist-native-bak/better-sqlite3-v11.5.0-electron-v130-win32-x64.tar/build/Release/better-sqlite3.node 解压到dist-native/better-sqlite3.node；
  - 本项目提供的better-sqlite3.node文件是针对electron33版本的，假如您使用的electron版本不是33，请自行到better-sqlite3项目里下载对应版本的better-sqlite3.node文件，并替换dist-native/better-sqlite3.node文件；

# arm64的Mac用户
  使用苹果M系列芯片的用户，在安装依赖前先把buildAssets/builder/config.js文件中的mac.target.arch的值改为['arm64']，然后重新安装依赖即可；

# 运行
yarn run dev（开发）
yarn run build（构建）
```

## 开源许可

本项目仅供个人学习研究使用，禁止用于商业及非法用途。

基于 [MIT license](https://opensource.org/licenses/MIT) 许可进行开源。

## 截图

![home-screenShot][home-screenShot] ![explore-screenShot][explore-screenShot] ![library-screenShot][library-screenShot] ![likepage-screenShot][likepage-screenShot] ![local-music-screenShot][local-music-screenShot] ![playlist-screenShot][playlist-screenShot] ![playpage-screenShot][playpage-screenShot] ![comment-screenShot][comment-screenShot] ![search-screenShot][search-screenShot] ![user-screenShot][user-screenShot] ![mv-screenShot][mv-screenShot] ![tray-lyric-screenShot][tray-lyric-screenShot]

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
