import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../data/mood_constants.dart';
import '../services/api_client.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
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
      final list = await context.read<ApiClient>().getList('/api/moods', query: {'limit': 50});
      setState(() => _items = list.cast<Map<String, dynamic>>());
    } catch (_) {
      setState(() => _items = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mood history')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(children: const [SizedBox(height: 120), Center(child: Text('No mood checks yet'))])
                  : ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: _items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final m = _items[i];
                        final mood = (m['mood'] as String?) ?? 'NEUTRAL';
                        final date = m['date'] as String?;
                        final conf = ((m['confidence'] as num?) ?? 0) * 100;
                        return GlassCard(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          child: Row(
                            children: [
                              Text(MoodConstants.emoji[mood] ?? '😐', style: const TextStyle(fontSize: 28)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(MoodConstants.label(mood), style: const TextStyle(fontWeight: FontWeight.w600)),
                                    if (date != null)
                                      Text(
                                        DateFormat.yMMMd().add_jm().format(DateTime.parse(date).toLocal()),
                                        style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.5)),
                                      ),
                                  ],
                                ),
                              ),
                              Text('${conf.round()}%', style: TextStyle(color: AppTheme.moodColor(mood))),
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
