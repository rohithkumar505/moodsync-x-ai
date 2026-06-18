import 'package:flutter/material.dart';

import '../models/models.dart';
import 'api_client.dart';

class AuthService extends ChangeNotifier {
  AuthService(this._api);

  final ApiClient _api;
  AppUser? user;
  bool loading = true;
  String? error;

  Future<void> bootstrap() async {
    loading = true;
    notifyListeners();
    try {
      if (await _api.hasToken()) {
        final data = await _api.get('/api/profile');
        final u = data['user'] ?? data;
        user = AppUser.fromJson(u as Map<String, dynamic>);
      }
    } catch (_) {
      await _api.clearToken();
      user = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    error = null;
    try {
      final data = await _api.post('/api/auth/login', data: {
        'email': email.trim().toLowerCase(),
        'password': password,
      });
      await _api.saveToken(data['token'] as String);
      user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
      notifyListeners();
      return true;
    } catch (e) {
      error = 'Login failed. Check email and password.';
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String name, String email, String password, String language) async {
    error = null;
    try {
      final data = await _api.post('/api/auth/register', data: {
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
        'preferredLanguage': language,
      });
      await _api.saveToken(data['token'] as String);
      user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
      notifyListeners();
      return true;
    } catch (e) {
      error = 'Registration failed. Email may already exist.';
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _api.clearToken();
    user = null;
    notifyListeners();
  }
}
