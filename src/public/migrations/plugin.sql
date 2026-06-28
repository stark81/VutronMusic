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

CREATE TABLE IF NOT EXISTS "Artist" (
    "id" TEXT PRIMARY KEY,

    "name" TEXT NOT NULL,
    "picUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "followed" INTEGER NOT NULL DEFAULT 0,

    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Album" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "picUrl" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "subscribed" INTEGER NOT NULL DEFAULT 0,
    "isExplicit" INTEGER NOT NULL DEFAULT 0,
    "publishTime" INTEGER NOT NULL DEFAULT 0,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Track" (
    "id" TEXT PRIMARY KEY,

    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,

    "albumId" TEXT,
    "no" INTEGER NOT NULL DEFAULT 0,
    "alias" TEXT NOT NULL DEFAULT '',
    "picUrl" TEXT NOT NULL DEFAULT '',
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "liked" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "musicBrainzTrackId" TEXT,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(albumId) REFERENCES Album(id)
);

CREATE TABLE IF NOT EXISTS "TrackArtist" (
    "trackId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    PRIMARY KEY(trackId, artistId)
);

CREATE TABLE IF NOT EXISTS "ArtistAlbum" (
    "artistId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    PRIMARY KEY(artistId, albumId)
);

CREATE TABLE IF NOT EXISTS "Audio" (
    "id" TEXT PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "md5" TEXT NOT NULL,
    "bitrate" INTEGER NOT NULL DEFAULT 0,
    "gain" REAL NOT NULL DEFAULT 0,
    "peak" REAL NOT NULL DEFAULT 1,
    "size" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "cueOffset" INTEGER NOT NULL DEFAULT 0,
    "cueDuration" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(trackId) REFERENCES Track(id)
);

CREATE TABLE IF NOT EXISTS "Lyrics" (
    "trackId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(trackId, pluginId)
);

CREATE TABLE IF NOT EXISTS "TrackSource" (
    "trackId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    "matched" INTEGER NOT NULL DEFAULT 1,  -- 当前音源与歌曲元数据是否已经过人工匹配确认
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(trackId, pluginId)
);

CREATE TABLE IF NOT EXISTS "AlbumSource" (
    "albumId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    PRIMARY KEY(albumId, pluginId)
);

CREATE TABLE IF NOT EXISTS "ArtistSource" (
    "artistId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    PRIMARY KEY(artistId, pluginId)
);

CREATE TABLE IF NOT EXISTS "Plugins" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL DEFAULT '',
    "builtIn" INTEGER NOT NULL DEFAULT 0,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "createTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO Plugins (id, name, type, builtIn) VALUES ('local', '本地音乐', 'local', 1);
INSERT OR IGNORE INTO Plugins (id, name, type, builtIn) VALUES ('kugou', '酷狗音乐', 'library', 1);
INSERT OR IGNORE INTO Plugins (id, name, type, builtIn) VALUES ('netease', '网易云音乐', 'library', 1);
INSERT OR IGNORE INTO Plugins (id, name, type, builtIn) VALUES ('emby', 'Emby', 'stream', 1);
INSERT OR IGNORE INTO Plugins (id, name, type, builtIn) VALUES ('jellyfin', 'Jellyfin', 'stream', 1);
INSERT OR IGNORE INTO Plugins (id, name, type, builtIn) VALUES ('navidrome', 'Navidrome', 'stream', 1);

CREATE TABLE IF NOT EXISTS "Playlist" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "picUrl" TEXT NOT NULL DEFAULT '',
    "createTime" INTEGER NOT NULL,
    "updateTime" INTEGER NOT NULL,
    PRIMARY KEY (id, pluginId)
);

CREATE TABLE IF NOT EXISTS "PlaylistEntry" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "playlistId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "sourceContext" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createTime" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_playlist_entry_playlist_id" ON "PlaylistEntry" ("playlistId");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_playlist_entry_unique" ON "PlaylistEntry" ("playlistId", "pluginId", "sourceContext");

CREATE TABLE IF NOT EXISTS "LyricOffsets" (
    "pluginId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "offset" REAL NOT NULL DEFAULT 0,
    "updateTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (pluginId, trackId)
);

COMMIT;
