import type { Song } from '../types/music';

export function getSaavnId(song: Song): string | undefined {
  if (song.saavnId) return song.saavnId;
  if (song.id?.startsWith('saavn-')) return song.id.replace('saavn-', '');
  return undefined;
}

/** Ensure saved playlist tracks always have play URLs and metadata for the player. */
export function normalizePlaylistSong(song: Song): Song {
  const saavnId = getSaavnId(song);
  return {
    ...song,
    saavnId,
    language: song.language || 'Hindi',
    mood: song.mood || 'NEUTRAL',
    playUrl: song.playUrl || (saavnId ? `/api/music/play/${saavnId}` : undefined),
    previewUrl: song.previewUrl || song.audioUrl,
  };
}

export function normalizePlaylistSongs(songs?: Song[] | null): Song[] {
  return (songs || []).map(normalizePlaylistSong);
}

export function buildSongPayload(song: Song) {
  const saavnId = getSaavnId(song);
  const dbId = song.id && !song.id.startsWith('saavn-') ? song.id : undefined;

  return {
    ...(dbId ? { songId: dbId } : {}),
    songName: song.songName,
    artist: song.artist,
    mood: song.mood || 'NEUTRAL',
    language: song.language || 'Hindi',
    album: song.album,
    movie: song.movie,
    saavnId,
    imageUrl: song.imageUrl,
    previewUrl: song.previewUrl || song.audioUrl,
    source: song.source || (saavnId ? 'saavn' : 'catalog'),
  };
}

export function isSongInPlaylist(song: Song, playlistSongs: Song[]): boolean {
  if (!playlistSongs.length) return false;
  const saavn = getSaavnId(song);
  return playlistSongs.some((s) => {
    if (song.id && s.id === song.id) return true;
    if (saavn && getSaavnId(s) === saavn) return true;
    return false;
  });
}
