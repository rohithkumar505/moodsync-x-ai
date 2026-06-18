import 'package:flutter/material.dart';

import '../screens/achievements_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/history_screen.dart';
import '../screens/journal_screen.dart';
import '../screens/mood_sync_screen.dart';
import '../screens/music_screen.dart';
import '../screens/playlists_screen.dart';
import '../screens/profile_screen.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _titles = ['Mood Sync', 'Home', 'Music', 'You'];

  final _pages = const [
    MoodSyncScreen(),
    DashboardScreen(),
    MusicScreen(),
    ProfileScreen(),
  ];

  void _open(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_index]),
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu_rounded),
            onPressed: () => Scaffold.of(ctx).openEndDrawer(),
          ),
        ),
      ),
      endDrawer: Drawer(
        backgroundColor: AppTheme.surface,
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 8),
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('MoodSync X AI', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              ListTile(
                leading: const Icon(Icons.history),
                title: const Text('Mood history'),
                onTap: () {
                  Navigator.pop(context);
                  _open(context, const HistoryScreen());
                },
              ),
              ListTile(
                leading: const Icon(Icons.book_outlined),
                title: const Text('Journal'),
                onTap: () {
                  Navigator.pop(context);
                  _open(context, const JournalScreen());
                },
              ),
              ListTile(
                leading: const Icon(Icons.emoji_events_outlined),
                title: const Text('Achievements'),
                onTap: () {
                  Navigator.pop(context);
                  _open(context, const AchievementsScreen());
                },
              ),
              ListTile(
                leading: const Icon(Icons.queue_music),
                title: const Text('Playlists'),
                onTap: () {
                  Navigator.pop(context);
                  _open(context, const PlaylistsScreen());
                },
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(child: _pages[_index]),
          const MiniPlayer(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.face_retouching_natural), label: 'Mood'),
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.library_music_outlined), label: 'Music'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'You'),
        ],
      ),
    );
  }
}
