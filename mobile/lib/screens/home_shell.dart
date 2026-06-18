import 'package:flutter/material.dart';

import '../widgets/common.dart';
import 'dashboard_screen.dart';
import 'mood_sync_screen.dart';
import 'music_screen.dart';
import 'profile_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _titles = ['Mood Sync', 'Dashboard', 'Music', 'You'];

  final _pages = const [
    MoodSyncScreen(),
    DashboardScreen(),
    MusicScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_titles[_index])),
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
