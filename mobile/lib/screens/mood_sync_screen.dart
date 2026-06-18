import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/mood_constants.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/mood_camera_service.dart';
import '../services/player_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class MoodSyncScreen extends StatefulWidget {
  const MoodSyncScreen({super.key});

  @override
  State<MoodSyncScreen> createState() => _MoodSyncScreenState();
}

class _MoodSyncScreenState extends State<MoodSyncScreen> {
  final _camera = MoodCameraController();
  String _language = 'Hindi';
  String? _detectedMood;
  String? _note;
  bool _syncing = false;
  bool _cameraOn = false;
  String? _error;
  double _confidence = 0;

  @override
  void dispose() {
    _camera.dispose();
    super.dispose();
  }

  Future<void> _startCamera() async {
    setState(() {
      _error = null;
      _syncing = true;
    });
    final err = await _camera.start();
    if (!mounted) return;
    setState(() {
      _syncing = false;
      _cameraOn = err == null && _camera.isReady;
      _error = err;
    });
  }

  Future<void> _syncMood(String mood, {double confidence = 0.85}) async {
    setState(() {
      _syncing = true;
      _error = null;
      _detectedMood = mood;
      _confidence = confidence;
    });
    try {
      final api = context.read<ApiClient>();
      final data = await api.post('/api/mood-sync', data: {
        'mood': mood,
        'confidence': confidence,
        'language': _language,
        'source': 'flutter_app',
      });
      final result = MoodSyncResult.fromJson(data);
      final songs = result.playlist.isNotEmpty
          ? result.playlist
          : (result.nowPlaying != null ? [result.nowPlaying!] : <Song>[]);
      setState(() => _note = result.note);
      if (songs.isNotEmpty && mounted) {
        await context.read<PlayerService>().playQueue(songs);
      } else if (mounted) {
        setState(() => _error = 'No songs found for this mood.');
      }
    } catch (e) {
      if (!mounted) return;
      final api = context.read<ApiClient>();
      setState(() => _error = api.errorMessage(e) ?? 'Could not sync mood.');
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _scanFace() async {
    if (!_cameraOn) {
      await _startCamera();
      if (!_cameraOn) return;
    }
    setState(() {
      _syncing = true;
      _error = null;
    });
    try {
      final bytes = await _camera.capture();
      if (bytes == null) throw Exception('Capture failed');
      final api = context.read<ApiClient>();
      final data = await api.analyzeFace(bytes, _language);
      final mood = (data['detectedMood'] as String?)?.toUpperCase();
      final confidence = (data['confidence'] as num?)?.toDouble() ?? 0.8;
      if (mood == null || !MoodConstants.moods.contains(mood)) {
        throw Exception('Could not detect mood — try better lighting.');
      }
      if (!mounted) return;
      await _syncMood(mood, confidence: confidence);
    } catch (e) {
      if (!mounted) return;
      final api = context.read<ApiClient>();
      if (mounted) {
        setState(() => _error = api.errorMessage(e) ?? e.toString().replaceFirst('Exception: ', ''));
        setState(() => _syncing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final preview = _camera.controller;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Mood Sync', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          'Scan your face or pick a mood — music matches instantly.',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13),
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _language,
          decoration: const InputDecoration(labelText: 'Music language'),
          items: MoodConstants.languages
              .map((l) => DropdownMenuItem(value: l, child: Text(l)))
              .toList(),
          onChanged: _syncing ? null : (v) => setState(() => _language = v ?? 'Hindi'),
        ),
        const SizedBox(height: 16),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: 3 / 4,
            child: Container(
              color: Colors.black26,
              child: _cameraOn && preview != null
                  ? CameraPreview(preview)
                  : Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.face_retouching_natural, size: 56, color: AppTheme.accent.withValues(alpha: 0.7)),
                          const SizedBox(height: 12),
                          Text('Camera off', style: TextStyle(color: Colors.white.withValues(alpha: 0.5))),
                        ],
                      ),
                    ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _syncing ? null : (_cameraOn ? _scanFace : _startCamera),
                icon: Icon(_cameraOn ? Icons.face : Icons.videocam),
                label: Text(_cameraOn ? 'Scan mood' : 'Enable camera'),
                style: FilledButton.styleFrom(backgroundColor: AppTheme.accent, padding: const EdgeInsets.symmetric(vertical: 14)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text('Or choose mood', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: MoodConstants.moods.map((m) {
            final selected = _detectedMood == m;
            return FilterChip(
              label: Text('${MoodConstants.emoji[m]} $m'),
              selected: selected,
              onSelected: _syncing ? null : (_) => _syncMood(m),
              backgroundColor: AppTheme.moodColor(m).withValues(alpha: 0.15),
              selectedColor: AppTheme.moodColor(m).withValues(alpha: 0.45),
            );
          }).toList(),
        ),
        if (_detectedMood != null) ...[
          const SizedBox(height: 12),
          Text(
            'Detected: ${MoodConstants.emoji[_detectedMood]} ${MoodConstants.label(_detectedMood!)} · ${(_confidence * 100).round()}%',
            style: TextStyle(color: AppTheme.moodColor(_detectedMood!), fontWeight: FontWeight.w600),
          ),
        ],
        if (_syncing) ...[
          const SizedBox(height: 24),
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 8),
          const Center(child: Text('Finding songs for your mood…')),
        ],
        if (_note != null && _note!.isNotEmpty) ...[
          const SizedBox(height: 20),
          GlassCard(child: Text(_note!, style: const TextStyle(height: 1.4))),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Colors.redAccent)),
        ],
      ],
    );
  }
}
