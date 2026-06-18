import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../services/player_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class MoodSyncScreen extends StatefulWidget {
  const MoodSyncScreen({super.key});

  @override
  State<MoodSyncScreen> createState() => _MoodSyncScreenState();
}

class _MoodSyncScreenState extends State<MoodSyncScreen> {
  String _language = 'Hindi';
  String? _detectedMood;
  String? _note;
  bool _syncing = false;
  String? _error;
  final _moods = ['HAPPY', 'SAD', 'ANGRY', 'RELAXED', 'NEUTRAL'];

  Future<void> _syncMood(String mood, {double confidence = 0.85}) async {
    setState(() {
      _syncing = true;
      _error = null;
      _detectedMood = mood;
    });
    try {
      final api = context.read<ApiClient>();
      final data = await api.post('/api/mood-sync', data: {
        'mood': mood,
        'confidence': confidence,
        'language': _language,
        'source': 'flutter_manual',
      });
      final result = MoodSyncResult.fromJson(data);
      final songs = result.playlist.isNotEmpty
          ? result.playlist
          : (result.nowPlaying != null ? [result.nowPlaying!] : <Song>[]);
      setState(() => _note = result.note);
      if (songs.isNotEmpty && mounted) {
        await context.read<PlayerService>().playQueue(songs);
      }
    } catch (e) {
      setState(() => _error = 'Could not sync mood. Check API connection.');
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Mood Sync', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text('Pick your mood or use the camera (coming soon on device)',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13)),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _language,
          decoration: const InputDecoration(labelText: 'Music language'),
          items: const ['English', 'Hindi', 'Tamil', 'Telugu', 'Punjabi', 'Kannada']
              .map((l) => DropdownMenuItem(value: l, child: Text(l)))
              .toList(),
          onChanged: (v) => setState(() => _language = v ?? 'Hindi'),
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _moods.map((m) {
            final selected = _detectedMood == m;
            return FilterChip(
              label: Text(m),
              selected: selected,
              onSelected: _syncing ? null : (_) => _syncMood(m),
              backgroundColor: AppTheme.moodColor(m).withValues(alpha: 0.15),
              selectedColor: AppTheme.moodColor(m).withValues(alpha: 0.45),
            );
          }).toList(),
        ),
        if (_syncing) ...[
          const SizedBox(height: 24),
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 8),
          const Center(child: Text('Finding songs for your mood…')),
        ],
        if (_note != null && _note!.isNotEmpty) ...[
          const SizedBox(height: 20),
          GlassCard(
            child: Text(_note!, style: const TextStyle(height: 1.4)),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Colors.redAccent)),
        ],
      ],
    );
  }
}
