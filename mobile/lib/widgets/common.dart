import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../services/player_service.dart';
import '../theme/app_theme.dart';

class MiniPlayer extends StatelessWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerService>();
    final song = player.current;
    if (song == null) return const SizedBox.shrink();

    return Material(
      color: AppTheme.surface.withValues(alpha: 0.98),
      child: InkWell(
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: AppTheme.accent.withValues(alpha: 0.3),
                child: const Icon(Icons.music_note, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(song.songName, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(song.artist, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6))),
                  ],
                ),
              ),
              if (player.loading)
                const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
              else
                StreamBuilder(
                  stream: player.playerState,
                  builder: (context, snap) {
                    final playing = snap.data?.playing ?? false;
                    return IconButton(
                      icon: Icon(playing ? Icons.pause_circle_filled : Icons.play_circle_filled),
                      onPressed: player.togglePlay,
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class SongTile extends StatelessWidget {
  const SongTile({super.key, required this.song, this.onTap, this.trailing});

  final Song song;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: song.imageUrl != null
            ? Image.network(song.imageUrl!, width: 48, height: 48, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _placeholder())
            : _placeholder(),
      ),
      title: Text(song.songName, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(song.artist, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: trailing ?? Icon(Icons.play_arrow, color: AppTheme.moodColor(song.mood)),
    );
  }

  Widget _placeholder() => Container(
        width: 48,
        height: 48,
        color: AppTheme.accent.withValues(alpha: 0.2),
        child: const Icon(Icons.music_note),
      );
}

class GlassCard extends StatelessWidget {
  const GlassCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: padding ?? const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}
