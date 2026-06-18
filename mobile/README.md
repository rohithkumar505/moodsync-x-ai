# MoodSync Flutter App

Native **Android & iOS** app for [MoodSync X AI](https://moodsync-x-ai.vercel.app).

## Features

- Login / Register (production API)
- **Face mood scan** (camera → AI → music playlist)
- Manual mood chips
- Dashboard + recommendations
- Music search & new releases
- Mini player (background audio)
- Drawer: History, Journal, Achievements, Playlists
- Profile + sign out

## Run on device

```bash
cd mobile
flutter pub get
dart run flutter_launcher_icons
flutter run
```

API is preconfigured: `https://moodsync-api.onrender.com`

**Demo login:** `demo@moodsync.ai` / `Demo1234`

## Build release

```bash
flutter build apk --release          # Android APK
flutter build appbundle --release  # Play Store
flutter build ios --release          # iOS (Mac + Xcode)
```

## Local backend

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:5001   # Android emulator
flutter run --dart-define=API_URL=http://127.0.0.1:5001  # iOS simulator
```
