# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

항상 한국어로 대답해줘.

## Project overview

Photo gallery web app — users can upload photos (EXIF date auto-extracted), view them in a grid, and request deletion. Admins at `/admin` can approve or reject deletion requests.

## Commands

### Backend (FastAPI)

```bash
cd backend

# First-time setup
cp .env.example .env          # then edit DATABASE_URL / ADMIN_KEY
pip install -r requirements.txt

# Run dev server (from backend/)
uvicorn app.main:app --reload --port 8000
```

### Frontend (React + Vite)

```bash
cd frontend

# First-time setup
npm install

# Run dev server (proxies /api and /uploads to localhost:8000)
npm run dev

# Production build
npm run build
```

### Database

Create the MySQL database before starting the backend — SQLAlchemy creates the tables automatically on startup:

```sql
CREATE DATABASE photogallery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Architecture

```
hajun/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, static /uploads mount, router registration
│   │   ├── database.py      # SQLAlchemy engine + get_db() dependency
│   │   ├── models.py        # Photo ORM model (id, filename, original_filename, date_taken, upload_date, status)
│   │   ├── schemas.py       # Pydantic schemas + enums (PhotoStatus, DeleteRequestAction)
│   │   └── routers/
│   │       ├── photos.py    # GET /api/photos, POST /api/photos/upload, POST /api/photos/{id}/request-deletion
│   │       └── admin.py     # GET /api/admin/pending, POST /api/admin/photos/{id}/action
│   ├── uploads/             # Uploaded image files (served as static files at /uploads/*)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api/index.js     # All axios calls to the backend
        ├── pages/
        │   ├── Gallery.jsx  # Main page: upload button + photo grid
        │   └── Admin.jsx    # /admin: password form then pending-deletion list
        └── components/
            └── PhotoCard.jsx  # Single photo card with request-deletion button
```

### Key design decisions

- **EXIF extraction** happens in `photos.py` using Pillow (`img._getexif()`, tag 36867 = DateTimeOriginal). Falls back to `datetime.now()` on any failure.
- **Admin auth** is a plain `x-admin-key` header checked against the `ADMIN_KEY` env var (default `admin123`). There is no JWT or session — the key is stored in component state and cleared on sign-out.
- **File storage** is local filesystem under `backend/uploads/`. Files are served by FastAPI's `StaticFiles` mount. Filenames are UUIDs to avoid collisions.
- **Photo status** is an enum: `active` or `pending_deletion`. Pending photos stay visible in the gallery with a badge; they are only removed from disk when an admin approves the deletion.
- **Vite proxy** forwards `/api/*` and `/uploads/*` to `localhost:8000` in dev, so the frontend never needs to know the backend port.

## Environment variables (backend/.env)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `mysql+pymysql://root:password@localhost:3306/photogallery` | MySQL connection |
| `UPLOAD_DIR` | `uploads` | Directory for stored images |
| `ADMIN_KEY` | `admin123` | Secret checked against `x-admin-key` header |
