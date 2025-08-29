BEGIN TRANSACTION;

UPDATE Track
SET json = json_set(
  json_set(
    json,
    '$.picUrl',
    CASE
      WHEN json_extract(json, '$.matched') = 0
      THEN '/local-asset/pic?id=' || json_extract(json, '$.id')
      ELSE json_extract(json, '$.picUrl')
    END
  ),
  '$.album.picUrl',
  CASE
    WHEN json_extract(json, '$.album.matched') = 0
    THEN '/local-asset/pic?id=' || json_extract(json, '$.album.id')
    ELSE json_extract(json, '$.album.picUrl')
  END
)
WHERE
  json_extract(json, '$.matched') = 0
  OR json_extract(json, '$.album.matched') = 0;

COMMIT;
