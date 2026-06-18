import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/player_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  List<Song> _recs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final api = context.read<ApiClient>();
    try {
      final dash = await api.get('/api/dashboard');
      final rec = await api.get('/api/dashboard/recommendations');
      final items = (rec['items'] as List<dynamic>?)
              ?.map((e) => Song.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      setState(() {
        _data = dash;
        _recs = items;
      });
    } catch (_) {
      setState(() => _data = null);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final stats = _data?['stats'] as Map<String, dynamic>? ?? {};
    final user = _data?['user'] as Map<String, dynamic>? ?? {};
    final name = user['name'] as String? ?? 'there';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Good day, $name', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          Row(
            children: [
              _stat('Streak', '${stats['streak'] ?? 0}', Icons.local_fire_department),
              const SizedBox(width: 12),
              _stat('Checks', '${stats['totalMoodChecks'] ?? 0}', Icons.favorite),
            ],
          ),
          const SizedBox(height: 20),
          Text('For you', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_recs.isEmpty)
            const Text('No recommendations yet — log a mood first.')
          else
            ..._recs.take(8).map((s) => SongTile(
                  song: s,
                  onTap: () => context.read<PlayerService>().playQueue(_recs, start: _recs.indexOf(s)),
                )),
        ],
      ),
    );
  }

  Widget _stat(String label, String value, IconData icon) {
    return Expanded(
      child: GlassCard(
        child: Row(
          children: [
            Icon(icon, color: AppTheme.accent),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.5))),
                Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
