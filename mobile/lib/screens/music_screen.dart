import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/player_service.dart';
import '../widgets/common.dart';

class MusicScreen extends StatefulWidget {
  const MusicScreen({super.key});

  @override
  State<MusicScreen> createState() => _MusicScreenState();
}

class _MusicScreenState extends State<MusicScreen> {
  final _query = TextEditingController();
  List<Song> _songs = [];
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<ApiClient>();
      final data = await api.get('/api/songs', query: {
        'q': _query.text.trim(),
        'per_page': 24,
        'page': 1,
      });
      final items = (data['items'] as List<dynamic>?)
              ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      setState(() => _songs = items);
    } catch (_) {
      setState(() {
        _error = 'Search failed';
        _songs = [];
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadNew() async {
    setState(() => _loading = true);
    try {
      final data = await context.read<ApiClient>().get('/api/music/new', query: {'limit': 24});
      final items = (data['items'] as List<dynamic>?)
              ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      setState(() => _songs = items);
    } catch (_) {
      setState(() => _songs = []);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _loadNew();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _query,
                  decoration: const InputDecoration(
                    hintText: 'Search songs, singers…',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onSubmitted: (_) => _search(),
                ),
              ),
              IconButton(onPressed: _search, icon: const Icon(Icons.arrow_forward)),
            ],
          ),
        ),
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null) Padding(padding: const EdgeInsets.all(8), child: Text(_error!)),
        Expanded(
          child: ListView.builder(
            itemCount: _songs.length,
            itemBuilder: (_, i) {
              final s = _songs[i];
              return SongTile(
                song: s,
                onTap: () => context.read<PlayerService>().playQueue(_songs, start: i),
              );
            },
          ),
        ),
      ],
    );
  }
}
