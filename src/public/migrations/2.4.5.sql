BEGIN TRANSACTION;

UPDATE Track
SET json = replace(json, '/local-asset/pic', 'atom://local-asset?type=pic')
WHERE json LIKE '%/local-asset%';

UPDATE Playlist
SET json = replace(json, 'atom://get-playlist-pic/', 'atom://local-asset?type=pic&size=512&id=')
WHERE Json LIKE '%atom://get-playlist-pic%';

COMMIT;
