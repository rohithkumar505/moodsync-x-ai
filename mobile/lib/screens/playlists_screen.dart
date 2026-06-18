import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/player_service.dart';
import '../widgets/common.dart';

class PlaylistsScreen extends StatefulWidget {
  const PlaylistsScreen({super.key});

  @override
  State<PlaylistsScreen> createState() => _PlaylistsScreenState();
}

class _PlaylistsScreenState extends State<PlaylistsScreen> {
  List<Map<String, dynamic>> _playlists = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await context.read<ApiClient>().getList('/api/playlists');
      setState(() => _playlists = list.cast<Map<String, dynamic>>());
    } catch (_) {
      setState(() => _playlists = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openPlaylist(String id, String name) async {
    try {
      final data = await context.read<ApiClient>().get('/api/playlists/$id');
      final songs = (data['songs'] as List<dynamic>?)
              ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      if (!mounted) return;
      if (songs.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Playlist is empty')));
        return;
      }
      await context.read<PlayerService>().playQueue(songs);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Playing $name')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not load playlist')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Playlists')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _playlists.isEmpty
                  ? ListView(children: const [SizedBox(height: 120), Center(child: Text('No playlists yet'))])
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _playlists.length,
                      itemBuilder: (_, i) {
                        final p = _playlists[i];
                        final name = p['name'] as String? ?? 'Playlist';
                        final count = (p['songCount'] as num?)?.toInt() ?? 0;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: GlassCard(
                            padding: EdgeInsets.zero,
                            child: ListTile(
                              leading: const Icon(Icons.queue_music),
                              title: Text(name),
                              subtitle: Text('$count songs'),
                              trailing: const Icon(Icons.play_arrow),
                              onTap: () => _openPlaylist(p['id'].toString(), name),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
