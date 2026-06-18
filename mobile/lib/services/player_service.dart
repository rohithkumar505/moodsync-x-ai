import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../models/models.dart';
import 'api_client.dart';

class PlayerService extends ChangeNotifier {
  PlayerService(this._api);

  final ApiClient _api;
  final AudioPlayer _player = AudioPlayer();
  List<Song> _queue = [];
  int _index = 0;
  Song? _current;
  bool _loading = false;

  Song? get current => _current;
  List<Song> get queue => _queue;
  bool get loading => _loading;
  Stream<PlayerState> get playerState => _player.playerStateStream;
  Stream<Duration?> get position => _player.positionStream;
  Stream<Duration?> get duration => _player.durationStream;

  Future<void> playQueue(List<Song> songs, {int start = 0}) async {
    if (songs.isEmpty) return;
    _queue = songs;
    _index = start.clamp(0, songs.length - 1);
    await _playAt(_index);
  }

  Future<void> _playAt(int i) async {
    _index = i;
    _current = _queue[i];
    _loading = true;
    notifyListeners();
    try {
      final path = _current!.streamPath;
      if (path == null) throw Exception('No play URL');
      final url = await _api.resolveAudioUrl(path);
      await _player.setUrl(url);
      await _player.play();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> togglePlay() async {
    if (_player.playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
    notifyListeners();
  }

  Future<void> next() async {
    if (_index + 1 < _queue.length) await _playAt(_index + 1);
  }

  Future<void> stop() async {
    await _player.stop();
    _current = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}
