# MoodSync Flutter app

Native Android/iOS client for the same MoodSync API as the web app.

## First-time setup

```bash
cd mobile
flutter create . --project-name moodsync_mobile --org com.moodsync
flutter pub get
dart run flutter_launcher_icons
```

Edit `lib/config/api_config.dart` → set `productionApiUrl` to your **Render** backend URL.

## Run

```bash
# Android emulator → backend on host machine
flutter run --dart-define=API_URL=http://10.0.2.2:5001

# Production API
flutter run
```

## Build

```bash
flutter build apk --release
flutter build appbundle --release
```

## Features (matches web mobile)

- Login / Register
- Mood Sync → playlist + player
- Dashboard + recommendations
- Music search & new releases
- Profile + sign out
- Mini player bar
