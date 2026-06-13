BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS "PluginData" (
  "id" TEXT NOT NULL,
  "pluginId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "json" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "AppData" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "Track" (
    "id" INTEGER NOT NULL,
    "pluginId" TEXT NOT NULL, -- 插件
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "picUrl" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "alias" TEXT NOT NULL DEFAULT '',
    "mvid" TEXT NOT NULL DEFAULT '',
    "albumId" INTEGER NOT NULL,

    -- 以下信息本应该和具体的音频相关联，但本地的情况下直接放在TrackMetadata里了
    "filePath" TEXT NOT NULL DEFAULT "",
    "md5" TEXT NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "bitrate" TEXT NOT NULL DEFAULT "480000",
    "gain" INTEGER NOT NULL DEFAULT 0,
    "peak" INTEGER NOT NULL DEFAULT 1,
    "offset" INTEGER NOT NULL DEFAULT 0,  -- 歌词延迟

    "type" TEXT NOT NULL DEFAULT "local", -- local, library, stream
    "deleted" INTEGER DEFAULT 0,
    "createTime" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, pluginId),
    FOREIGN KEY(albumId) REFERENCES Album(id)
);

CREATE TABLE IF NOT EXISTS "Album" (
    "id" INTEGER NOT NULL,
    "pluginId" TEXT NOT NULL, -- 插件
    "name" TEXT NOT NULL,
    "picUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,  -- 专辑、EP、单曲等
    "company" TEXT NOT NULL,
    "createTime" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "subscribed" INTEGER DEFAULT 0, -- 正常情况应该是用户表与专辑、歌手之间形成收藏的关联表，但本地音乐不存在用户表，所以直接设置字段
    "isExplicit" INTEGER DEFAULT 0,

    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, pluginId)
);

CREATE TABLE IF NOT EXISTS "Artist" (
    "id" INTEGER NOT NULL,
    "pluginId" TEXT NOT NULL, -- 插件
    "name" TEXT NOT NULL,
    "picUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "followed" INTEGER DEFAULT 0,

    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, pluginId)
);

CREATE TABLE IF NOT EXISTS "TrackArtist" (
    "trackId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,

    PRIMARY KEY (trackId, artistId),
    FOREIGN KEY(trackId) REFERENCES Track(id),
    FOREIGN KEY(artistId) REFERENCES Artist(id)
);

-- CREATE TABLE IF NOT EXISTS "Playlist" (
--     "id" INTEGER NOT NULL,
--     "pluginId" TEXT NOT NULL, -- 插件
--     "name" TEXT NOT NULL,
--     "picUrl" TEXT NOT NULL,
--     "description" TEXT NOT NULL,
--     "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
-- )

-- -- 本地歌曲与歌曲入口的关联表
-- -- 本地歌单可以添加各个插件里的歌曲，所以这里应当保存歌单、以及能获取到歌曲的最小上下文，以及继续执行后续操作所需的上下文信息
-- CREATE TABLE IF NOT EXISTS "PlaylistEntry" (
--     "id" INTEGER PRIMARY KEY AUTOINCREMENT,
--     "playlistId" TEXT NOT NULL,
--     "pluginId" TEXT NOT NULL,
--     "sourceContext" TEXT NOT NULL DEFAULT '{}',
--     "snapshot" TEXT NOT NULL DEFAULT '{}',
--     "position" INTEGER NOT NULL,
--     "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     UNIQUE("playlistId", "pluginId", "sourceContext")
-- );

-- CREATE INDEX IF NOT EXISTS "idx_playlist_entry_playlist_position" ON "PlaylistEntry" ("playlistId", "position");

COMMIT;
