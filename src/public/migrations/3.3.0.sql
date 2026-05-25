BEGIN TRANSACTION;

--------------------------------------------------
-- PluginData（新增，替代 AccountData）,
-- PluginData.id 为插件名称
--------------------------------------------------

CREATE TABLE IF NOT EXISTS "PluginData" (
  "id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "json" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

--------------------------------------------------
-- Track
--------------------------------------------------

CREATE TABLE "Track_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "type" Text NOT NULL,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "Track_new"
SELECT 
    id,
    CASE 
        WHEN type = 'local' THEN 'local'
        ELSE 'netease'
    END,
    type,
    json,
    updatedAt
FROM "Track";

DROP TABLE "Track";
ALTER TABLE "Track_new" RENAME TO "Track";

UPDATE Track
SET json = replace(json, 'atom://', 'vutron://')
WHERE json LIKE '%atom://%';

--------------------------------------------------
-- Album
--------------------------------------------------

CREATE TABLE "Album_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "matched" INTEGER DEFAULT 0,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "Album_new"
SELECT 
    id,
    'netease',
    matched,
    json,
    updatedAt
FROM "Album";

DROP TABLE "Album";
ALTER TABLE "Album_new" RENAME TO "Album";

--------------------------------------------------
-- Artist
--------------------------------------------------

CREATE TABLE "Artist_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "matched" INTEGER DEFAULT 0,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "Artist_new"
SELECT 
    id,
    'netease',
    matched,
    json,
    updatedAt
FROM "Artist";

DROP TABLE "Artist";
ALTER TABLE "Artist_new" RENAME TO "Artist";

--------------------------------------------------
-- Playlist
--------------------------------------------------

CREATE TABLE "Playlist_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "isLocal" INTEGER DEFAULT 0,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "Playlist_new"
SELECT 
    id,
    CASE 
        WHEN isLocal = 1 THEN 'local'
        ELSE 'netease'
    END,
    isLocal,
    json,
    updatedAt
FROM "Playlist";

DROP TABLE "Playlist";
ALTER TABLE "Playlist_new" RENAME TO "Playlist";

UPDATE Playlist
SET json = replace(json, 'atom://', 'vutron://')
WHERE json LIKE '%atom://%';

--------------------------------------------------
-- Audio
--------------------------------------------------

CREATE TABLE "Audio_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "bitRate" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "queriedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "Audio_new"
SELECT 
    id,
    source, -- 这里直接用 source 作为 platform（关键）
    bitRate,
    format,
    source,
    queriedAt
FROM "Audio";

DROP TABLE "Audio";
ALTER TABLE "Audio_new" RENAME TO "Audio";

--------------------------------------------------
-- Lyrics
--------------------------------------------------

CREATE TABLE "Lyrics_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "Lyrics_new"
SELECT 
    id,
    'netease',
    json,
    updatedAt
FROM "Lyrics";

DROP TABLE "Lyrics";
ALTER TABLE "Lyrics_new" RENAME TO "Lyrics";

--------------------------------------------------
-- ArtistAlbum
--------------------------------------------------

CREATE TABLE "ArtistAlbum_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "hotAlbums" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "ArtistAlbum_new"
SELECT 
    id,
    'netease',
    hotAlbums,
    updatedAt
FROM "ArtistAlbum";

DROP TABLE "ArtistAlbum";
ALTER TABLE "ArtistAlbum_new" RENAME TO "ArtistAlbum";

--------------------------------------------------
-- LocalAlbumCover
--------------------------------------------------

CREATE TABLE "LocalAlbumCover_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'local',
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "LocalAlbumCover_new"
SELECT 
    id,
    'local',
    json,
    updatedAt
FROM "LocalAlbumCover";

DROP TABLE "LocalAlbumCover";
ALTER TABLE "LocalAlbumCover_new" RENAME TO "LocalAlbumCover";

--------------------------------------------------
-- Unblock
--------------------------------------------------

CREATE TABLE "Unblock_new" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, platform)
);

INSERT INTO "Unblock_new"
SELECT 
    id,
    'netease',
    json,
    updatedAt
FROM "Unblock";

DROP TABLE "Unblock";
ALTER TABLE "Unblock_new" RENAME TO "Unblock";

--------------------------------------------------
-- 删除旧 AccountData（可选）
--------------------------------------------------

DROP TABLE IF EXISTS "AccountData";

--------------------------------------------------
-- 索引
--------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_track_platform ON Track(platform);
CREATE INDEX IF NOT EXISTS idx_album_platform ON Album(platform);
CREATE INDEX IF NOT EXISTS idx_artist_platform ON Artist(platform);
CREATE INDEX IF NOT EXISTS idx_playlist_platform ON Playlist(platform);
CREATE INDEX IF NOT EXISTS idx_audio_platform ON Audio(platform);
CREATE INDEX IF NOT EXISTS idx_lyrics_platform ON Lyrics(platform);

COMMIT;