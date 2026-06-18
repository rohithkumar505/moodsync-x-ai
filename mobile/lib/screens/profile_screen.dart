import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/api_config.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.user;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        GlassCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: AppTheme.accent.withValues(alpha: 0.3),
                child: Text(
                  (user?.name.isNotEmpty == true ? user!.name[0] : '?').toUpperCase(),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user?.name ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                    Text(user?.email ?? '', style: TextStyle(color: Colors.white.withValues(alpha: 0.55))),
                    if (user?.preferredLanguage != null)
                      Text('Language: ${user!.preferredLanguage}',
                          style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.45))),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('API', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(ApiConfig.baseUrl, style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.5))),
            ],
          ),
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: () async {
            await auth.logout();
            if (context.mounted) Navigator.of(context).pushReplacementNamed('/login');
          },
          icon: const Icon(Icons.logout),
          label: const Text('Sign out'),
          style: FilledButton.styleFrom(backgroundColor: Colors.redAccent.withValues(alpha: 0.85)),
        ),
      ],
    );
  }
}
