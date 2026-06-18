import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _register = false;
  final _name = TextEditingController();
  String _language = 'Hindi';

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _loading = true);
    final auth = context.read<AuthService>();
    final ok = _register
        ? await auth.register(_name.text, _email.text, _password.text, _language)
        : await auth.login(_email.text, _password.text);
    if (mounted) setState(() => _loading = false);
    if (ok && mounted) {
      Navigator.of(context).pushReplacementNamed('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Icon(Icons.auto_awesome, size: 56, color: AppTheme.accent),
              const SizedBox(height: 12),
              Text(
                'MoodSync X AI',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                'Your mood, your music',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
              ),
              const SizedBox(height: 40),
              if (_register) ...[
                TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _language,
                  decoration: const InputDecoration(labelText: 'Language'),
                  items: const [
                    'English', 'Hindi', 'Tamil', 'Telugu', 'Punjabi', 'Kannada',
                  ].map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
                  onChanged: (v) => setState(() => _language = v ?? 'Hindi'),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password'),
              ),
              if (auth.error != null) ...[
                const SizedBox(height: 12),
                Text(auth.error!, style: const TextStyle(color: Colors.redAccent)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _submit,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  backgroundColor: AppTheme.accent,
                ),
                child: _loading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(_register ? 'Create account' : 'Sign in'),
              ),
              TextButton(
                onPressed: () => setState(() => _register = !_register),
                child: Text(_register ? 'Already have an account? Sign in' : 'New here? Register'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
