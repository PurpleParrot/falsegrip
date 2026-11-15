# Falsegrip

Persönlicher Trainings-Tracker für Calisthenics und Gym. Progressive Web App, offline-fähig, Daten lokal im Browser (IndexedDB).
Spezifikation: `SPEC Falsegrip v0.4.md`.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173 (mit --host auch im WLAN erreichbar)
npm run build    # Produktions-Build nach dist/
```

## Deployment

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages:
`https://<github-user>.github.io/<repo-name>/`

## Technik

- Vite + React + TypeScript
- Dexie (IndexedDB) für Daten, jedes Objekt mit `id`, `createdAt`, `updatedAt`, `deletedAt` (vorbereitet für Sync in Phase 3)
- vite-plugin-pwa (Service Worker, Manifest, Offline)
- UI-Texte zentral in `src/i18n.ts`

## Struktur

- `src/model.ts` Datenmodell
- `src/db.ts` Datenbank, Starter-Bibliothek, Backup
- `src/sessions.ts` Trainings-Logik, Vorschlagswerte
- `src/stats.ts` Kennzahlen, CSV-Export
- `src/timer.ts` Timer
- `src/screens/` Screens, `src/components/` Bausteine
