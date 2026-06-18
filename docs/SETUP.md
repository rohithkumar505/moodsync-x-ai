# Setup Guide

## Prerequisites
- Python 3.9+
- Node.js 18+
- (Optional) PostgreSQL or Docker

## Local Development

1. Clone / open the project
2. Copy `.env.example` to `backend/.env`
3. Start backend: `cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python app.py`
4. Start frontend: `cd frontend && npm install && npm run dev`
5. Open http://localhost:5173
6. Register a new account and start checking in moods

## Optional: OpenAI
Set `OPENAI_API_KEY` in `backend/.env` for AI text/image mood analysis.

## Database (PostgreSQL)

MoodSync uses **PostgreSQL** directly (no SQLite by default).

1. Start Postgres:
   ```bash
   docker compose up -d db
   ```
2. Copy env file:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Start the backend — tables are created automatically on first run.

Connection defaults: `postgresql://moodsync:moodsync@localhost:5432/moodsync`

Override with `DATABASE_URL` or `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` in `backend/.env`.
