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

# Windows用户创建本地环境变量
cp .env.example .env
同时将 dist-native/better-sqlite3-v11.5.0-electron-v130-win32-x64.tar/build/Release/better-sqlite3.node 解压到dist-native/better-sqlite3.node

# 运行
yarn run dev（开发）
yarn run build（构建）
```

## 开源许可

本项目仅供个人学习研究使用，禁止用于商业及非法用途。

基于 [MIT license](https://opensource.org/licenses/MIT) 许可进行开源。

[localMusic-screenShot]: images/localMusic.jpg
