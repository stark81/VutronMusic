/* eslint-disable no-unused-vars */

export enum CacheAPIs {
  Album = 'album',
  Artist = 'artists',
  ArtistAlbum = 'artist/album',
  Likelist = 'likelist',
  Lyric = 'lyric',
  Personalized = 'personalized',
  Playlist = 'playlist/detail',
  RecommendResource = 'recommend/resource',
  SongUrl = 'song/url/v1',
  Track = 'song/detail',
  UserAccount = 'user/account',
  UserAlbums = 'album/sublist',
  UserArtists = 'artist/sublist',
  UserPlaylist = 'user/playlist',
  SimilarArtist = 'simi/artist',
  ArtistSongs = 'artist/songs',
  ListenedRecords = 'user/record',
  Unblock = 'unblock',
  TopSong = 'top/song',
  searchMatch = 'search/match',
  loginStatus = 'login/status',
  recommendTracks = 'recommend/songs',
  CloudDisk = 'user/cloud',

  // not netease api
  LocalMusic = 'local_music',
  LocalPlaylist = 'local_playlist',
  CoverColor = 'cover_color',
  AppleMusicAlbum = 'apple_music_album',
  AppleMusicArtist = 'apple_music_artist'
}
