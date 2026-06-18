# MoodSync X AI

**Your Mood, Your Music** — Intelligent music recommendation and emotional wellness platform.

## Features

- User authentication (register, login, JWT sessions)
- Mood check-in with 5 moods, confidence scores, optional text & image analysis
- Daily journals with auto-detected mood
- Mood history, analytics (pie/bar/line charts)
- Emotion DNA profile, mood prediction, achievements
- Song recommendations & playlist management
- Exportable reports

## Quick Start

### Backend (Flask)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env
python app.py
```

Runs at http://localhost:5001

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173 (proxies API to backend)

### Docker

```bash
docker-compose up --build
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:5000

## Project Structure

```
backend/
  app.py              # Flask routes
  models.py           # 7 database tables
  services/           # mood, dashboard, charts, achievements, DNA, uploads
  engines/            # mood_detector, emotion_engine
  music/              # music_library, song_recommender
  data/seed_songs.py  # Song catalog seeder
frontend/
  src/pages/          # All UI pages (glassmorphism design)
  src/components/     # Charts, mood cards, sidebar
```

## API

See [docs/API.md](docs/API.md) for endpoint reference.

## Tests

```bash
cd backend && source venv/bin/activate && pytest
```

## Tech Stack

- **Backend:** Python Flask, SQLAlchemy, JWT, bcrypt
- **Frontend:** React, Vite, Tailwind CSS, Recharts
- **Database:** SQLite (dev) / PostgreSQL (production)
