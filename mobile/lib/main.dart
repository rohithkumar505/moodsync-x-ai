import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config/api_config.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
import 'services/auth_service.dart';
import 'services/player_service.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthService(api)..bootstrap()),
        ChangeNotifierProvider(create: (_) => PlayerService(api)),
      ],
      child: const MoodSyncApp(),
    ),
  );
}

class MoodSyncApp extends StatelessWidget {
  const MoodSyncApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MoodSync X AI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      initialRoute: '/',
      routes: {
        '/': (_) => const _SplashGate(),
        '/login': (_) => const LoginScreen(),
        '/home': (_) => const HomeShell(),
      },
    );
  }
}

class _SplashGate extends StatelessWidget {
  const _SplashGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    if (auth.loading) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.auto_awesome, size: 48, color: AppTheme.accent),
              const SizedBox(height: 16),
              const CircularProgressIndicator(),
              const SizedBox(height: 12),
              Text('MoodSync', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(ApiConfig.baseUrl, style: TextStyle(fontSize: 11, color: Colors.white38)),
            ],
          ),
        ),
      );
    }
    if (auth.user != null) {
      return const HomeShell();
    }
    return const LoginScreen();
  }
}
