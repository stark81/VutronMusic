DROP INDEX IF EXISTS filePath;
DROP INDEX IF EXISTS deleted;

CREATE TABLE IF NOT EXISTS Track_new (
  "id" INTEGER NOT NULL,
  "type" TEXT DEFAULT "",
  "json" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT OR REPLACE INTO Track_new (id, type, json, updatedAt)
SELECT id, 'local', json_set(
  json_remove(json, '$.isLocal', '$.deleted', '$.show'),
  '$.type', 'local'
), updatedAt FROM Track;