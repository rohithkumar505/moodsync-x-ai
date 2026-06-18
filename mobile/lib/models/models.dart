import 'dart:convert';

class AppUser {
  final String id;
  final String name;
  final String email;
  final String? preferredLanguage;
  final bool isAdmin;

  AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.preferredLanguage,
    this.isAdmin = false,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id']?.toString() ?? '',
        name: json['name'] as String? ?? '',
        email: json['email'] as String? ?? '',
        preferredLanguage: json['preferredLanguage'] as String?,
        isAdmin: json['isAdmin'] == true,
      );
}

class Song {
  final String id;
  final String songName;
  final String artist;
  final String mood;
  final String language;
  final String? album;
  final String? movie;
  final String? audioUrl;
  final String? previewUrl;
  final String? playUrl;
  final String? saavnId;
  final String? imageUrl;

  Song({
    required this.id,
    required this.songName,
    required this.artist,
    required this.mood,
    required this.language,
    this.album,
    this.movie,
    this.audioUrl,
    this.previewUrl,
    this.playUrl,
    this.saavnId,
    this.imageUrl,
  });

  factory Song.fromJson(Map<String, dynamic> json) => Song(
        id: json['id']?.toString() ?? json['saavnId']?.toString() ?? '',
        songName: json['songName'] as String? ?? '',
        artist: json['artist'] as String? ?? '',
        mood: json['mood'] as String? ?? 'NEUTRAL',
        language: json['language'] as String? ?? 'Hindi',
        album: json['album'] as String?,
        movie: json['movie'] as String?,
        audioUrl: json['audioUrl'] as String?,
        previewUrl: json['previewUrl'] as String?,
        playUrl: json['playUrl'] as String?,
        saavnId: json['saavnId'] as String?,
        imageUrl: json['imageUrl'] as String?,
      );

  String? get streamPath {
    if (playUrl != null && playUrl!.isNotEmpty) return playUrl;
    if (saavnId != null && saavnId!.isNotEmpty) return '/api/music/play/$saavnId';
    if (audioUrl != null && audioUrl!.startsWith('http')) return audioUrl;
    return audioUrl;
  }
}

class MoodSyncResult {
  final String mood;
  final List<Song> playlist;
  final String? note;
  final Song? nowPlaying;

  MoodSyncResult({
    required this.mood,
    required this.playlist,
    this.note,
    this.nowPlaying,
  });

  factory MoodSyncResult.fromJson(Map<String, dynamic> json) {
    final list = (json['moodPlaylist'] as List<dynamic>?)
            ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final np = json['nowPlaying'];
    return MoodSyncResult(
      mood: json['detectedMood'] as String? ?? json['mood']?['mood'] as String? ?? 'NEUTRAL',
      playlist: list,
      note: json['therapeuticNote'] as String? ?? json['message'] as String?,
      nowPlaying: np != null ? Song.fromJson(np as Map<String, dynamic>) : null,
    );
  }
}

String? extractApiError(Object? data) {
  if (data is Map && data['error'] is String) return data['error'] as String;
  return null;
}

Map<String, dynamic>? tryDecodeMap(String body) {
  try {
    final v = jsonDecode(body);
    if (v is Map<String, dynamic>) return v;
  } catch (_) {}
  return null;
}
