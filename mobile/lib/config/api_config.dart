/// API base URL — change productionApiUrl after Render deploy.
class ApiConfig {
  static const String productionApiUrl = 'https://moodsync-api.onrender.com';

  /// Override for local dev: `flutter run --dart-define=API_URL=http://10.0.2.2:5001`
  static String get baseUrl {
    const fromEnv = String.fromEnvironment('API_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    return productionApiUrl;
  }
}
