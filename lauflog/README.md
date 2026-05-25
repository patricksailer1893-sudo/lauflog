# LaufLog 🏃

Persönliches Trainings-Dashboard für Laufen & Peloton.

## Features
- GPX & TCX Import (Strava)
- Alle Peloton Workout-Typen
- HF-Zonen mit 80/20-Check
- Aktivitäts-Heatmap & Streak
- Dashboard mit Bestleistungen
- Wöchentliche / monatliche / jährliche Übersicht

## Deployment auf Vercel

### Schritt 1: GitHub
1. Geh auf github.com → "New repository"
2. Name: `lauflog` → "Create repository"
3. Klick "uploading an existing file"
4. Alle Dateien aus diesem Ordner hochladen
5. Commit: "Initial commit"

### Schritt 2: Vercel
1. Geh auf vercel.com → kostenlos registrieren
2. "New Project" → "Import Git Repository"
3. GitHub verbinden → `lauflog` auswählen
4. Framework: **Vite** (wird automatisch erkannt)
5. "Deploy" klicken

Fertig! Du bekommst eine URL wie `lauflog.vercel.app`

## Lokale Entwicklung
```bash
npm install
npm run dev
```
