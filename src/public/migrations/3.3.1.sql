BEGIN TRANSACTION;
  ALTER TABLE Plugins ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 9999;
  UPDATE Plugins SET sortOrder = 1 WHERE id = 'netease' AND sortOrder = 9999;
  UPDATE Plugins SET sortOrder = 2 WHERE id = 'kugou' AND sortOrder = 9999;
COMMIT;
