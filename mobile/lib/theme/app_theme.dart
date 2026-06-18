import 'package:flutter/material.dart';

class AppTheme {
  static const bg = Color(0xFF0F0C29);
  static const surface = Color(0xFF302B63);
  static const accent = Color(0xFF667EEA);
  static const accent2 = Color(0xFF764BA2);

  static const moodHappy = Color(0xFFF59E0B);
  static const moodSad = Color(0xFF3B82F6);
  static const moodAngry = Color(0xFFEF4444);
  static const moodRelaxed = Color(0xFF22C55E);
  static const moodNeutral = Color(0xFF9CA3AF);

  static Color moodColor(String mood) {
    switch (mood.toUpperCase()) {
      case 'HAPPY':
        return moodHappy;
      case 'SAD':
        return moodSad;
      case 'ANGRY':
        return moodAngry;
      case 'RELAXED':
        return moodRelaxed;
      default:
        return moodNeutral;
    }
  }

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      colorScheme: const ColorScheme.dark(
        primary: accent,
        secondary: accent2,
        surface: surface,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardTheme(
        color: Colors.white.withValues(alpha: 0.06),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.06),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface.withValues(alpha: 0.95),
        indicatorColor: accent.withValues(alpha: 0.25),
        labelTextStyle: WidgetStateProperty.all(const TextStyle(fontSize: 11)),
      ),
    );
  }
}
