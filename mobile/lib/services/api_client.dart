import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/api_config.dart';

class ApiClient {
  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 45),
      headers: {'Content-Type': 'application/json'},
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _token();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));
  }

  late final Dio _dio;
  static const _tokenKey = 'moodsync_token';

  Future<String?> _token() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(_tokenKey);
  }

  Future<void> saveToken(String token) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_tokenKey, token);
  }

  Future<void> clearToken() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_tokenKey);
  }

  Future<bool> hasToken() async => (await _token()) != null;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    final r = await _dio.get<Map<String, dynamic>>(path, queryParameters: query);
    return r.data ?? {};
  }

  Future<Map<String, dynamic>> post(String path, {Object? data}) async {
    final r = await _dio.post<Map<String, dynamic>>(path, data: data);
    return r.data ?? {};
  }

  Future<Map<String, dynamic>> patch(String path, {Object? data}) async {
    final r = await _dio.patch<Map<String, dynamic>>(path, data: data);
    return r.data ?? {};
  }

  Future<List<dynamic>> getList(String path, {Map<String, dynamic>? query}) async {
    final r = await _dio.get<dynamic>(path, queryParameters: query);
    final data = r.data;
    if (data is List) return data;
    if (data is Map && data['items'] is List) return data['items'] as List;
    if (data is Map && data['songs'] is List) return data['songs'] as List;
    return [];
  }

  Future<String> resolveAudioUrl(String path) async {
    if (path.startsWith('http')) return path;
    final r = await _dio.get<Map<String, dynamic>>(path);
    final url = r.data?['audioUrl'] as String?;
    if (url == null || url.isEmpty) throw Exception('No stream URL');
    return url;
  }

  Future<Map<String, dynamic>> analyzeFace(List<int> imageBytes, String language) async {
    final form = FormData.fromMap({
      'file': MultipartFile.fromBytes(imageBytes, filename: 'face.jpg'),
      'language': language,
    });
    final r = await _dio.post<Map<String, dynamic>>('/api/analyze/face', data: form);
    return r.data ?? {};
  }

  Future<bool> healthCheck() async {
    try {
      final r = await _dio.get<Map<String, dynamic>>('/api/health');
      return r.data?['status'] == 'ok' || r.data?['status'] == 'degraded';
    } catch (_) {
      return false;
    }
  }

  String? errorMessage(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
      if (e.type == DioExceptionType.connectionTimeout) return 'Connection timed out';
      if (e.type == DioExceptionType.connectionError) return 'Cannot reach server';
    }
    return null;
  }

  DioException? asDio(Object e) => e is DioException ? e : null;
}
