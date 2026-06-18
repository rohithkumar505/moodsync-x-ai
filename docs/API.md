# API Reference

Base URL: `http://localhost:5000`

## Auth
- `POST /api/auth/register` — `{ name, email, password }`
- `POST /api/auth/login` — `{ email, password }`
- `GET /api/profile` — JWT required
- `PATCH /api/profile` — `{ name?, password? }`

## Moods
- `POST /api/moods` — `{ mood, journalText?, imagePath?, confidence?, source? }`
- `GET /api/moods?page=1`

## Journals
- `POST /api/journals` — `{ journalText, date?, detectedMood? }`
- `GET /api/journals`

## Charts & Analytics
- `GET /api/charts/distribution`
- `GET /api/charts/frequency`
- `GET /api/charts/trend?period=daily&days=7`
- `GET /api/analytics/summary`
- `GET /api/emotion-dna`
- `GET /api/mood-prediction`

## Music
- `GET /api/recommendations?strategy=current|dna|predicted`
- `GET /api/playlists`
- `POST /api/playlists` — `{ playlistName }`
- `GET/PATCH/DELETE /api/playlists/:id`
- `POST /api/playlists/:id/songs` — `{ songId }`
- `DELETE /api/playlists/:id/songs/:songId`

## Other
- `GET /api/dashboard` — aggregated dashboard data
- `GET /api/achievements`
- `GET /api/reports`
- `POST /api/upload/mood-image` — multipart file
- `GET /api/health`

All protected routes require header: `Authorization: Bearer <token>`
