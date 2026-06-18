import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class AchievementsScreen extends StatefulWidget {
  const AchievementsScreen({super.key});

  @override
  State<AchievementsScreen> createState() => _AchievementsScreenState();
}

class _AchievementsScreenState extends State<AchievementsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await context.read<ApiClient>().get('/api/achievements');
      final items = data['items'] as List<dynamic>? ?? [];
      setState(() => _items = items.cast<Map<String, dynamic>>());
    } catch (_) {
      setState(() => _items = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unlocked = _items.where((a) => a['unlocked'] == true).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Achievements')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  GlassCard(
                    child: Text('$unlocked / ${_items.length} unlocked', style: Theme.of(context).textTheme.titleMedium),
                  ),
                  const SizedBox(height: 12),
                  ..._items.map((a) {
                    final done = a['unlocked'] == true;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: GlassCard(
                        child: Row(
                          children: [
                            Icon(done ? Icons.emoji_events : Icons.lock_outline, color: done ? Colors.amber : Colors.white38),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(a['name'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                                  Text(a['description'] as String? ?? '', style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.55))),
                                  const SizedBox(height: 6),
                                  LinearProgressIndicator(
                                    value: ((a['percent'] as num?) ?? 0) / 100,
                                    backgroundColor: Colors.white12,
                                    color: AppTheme.accent,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}
