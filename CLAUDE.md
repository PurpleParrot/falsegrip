# Falsegrip: Kontext für neue Sessions

Persönlicher Calisthenics- und Gym-Tracker als PWA, ersetzt RepCount. Grundlage ist `SPEC Falsegrip v0.4.md`. Viele Funktionen kamen später dazu und stehen unten unter „Stand der Funktionen“.

- Live: https://purpleparrot.github.io/falsegrip/
- Repo: PurpleParrot/falsegrip (öffentlich)

## Zusammenarbeit

- **UI-Sprache ist Deutsch, Übungsnamen sind Englisch.** Alle UI-Texte liegen zentral in `src/i18n.ts`.
- **Mit dem Nutzer auf Deutsch sprechen.**
- **Ablauf:** Code ändern, `npm test` laufen lassen, im Browser-Pane testen (`localhost:5173`, mobile Viewport), committen, auf `main` pushen. GitHub Actions deployt dann auf Pages.
  - Den Deploy mit `gh run watch <id>` abwarten.
  - Dieser Ablauf ist mit dem Nutzer abgesprochen. Pushen braucht keine Extra-Nachfrage.
- **Commits:**
  - Git-Identität ist die noreply-Adresse. Private Daten des Nutzers kommen nie in Commits oder externe Dienste.
  - Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Ehrlich berichten:** sagen, was getestet wurde und was nicht. Auf einem echten Handy wird meist nicht getestet.
- **Arbeitsweise:** Der Nutzer iteriert gern in kleinen Schritten, zum Beispiel beim Timer-Sound. Schnell umsetzen und deployen, dann auf Feedback warten.
- **Diese Datei pflegen:** Nach jeder neuen Funktion „Stand der Funktionen“ (und ggf. „Wichtige Dateien“) aktualisieren und mitcommitten.

## Technik

- **Stack:** Vite 8, React 19, TypeScript, Dexie 4 (IndexedDB, `useLiveQuery`), vite-plugin-pwa (generateSW, autoUpdate).
- **Dev-Server:** `npx vite --port 5173 --strictPort`.
- **Prüfen:** `npx tsc -b` für den Typcheck, `npm test` für die Tests, `npm run build` für den Build.
- **Tests:** Vitest (`vitest.config.ts`, getrennt von `vite.config.ts`), Dateien `src/*.test.ts`, Helfer in `src/test/`. IndexedDB kommt in Tests von `fake-indexeddb`. Abgedeckt: Superset-Helfer, Volumen/e1RM/Totals/CSV, letzte Werte, Bestleistungen, `parseBackup`, `mergeBackup`, Überschreiben/Wiederherstellen. Der Deploy-Workflow führt `npm test` vor dem Build aus: rote Tests verhindern den Deploy.
- **Testdaten im Browser:** Im Dev-Server lassen sich Module direkt laden, z. B. `const { db } = await import('/src/db.ts')` im `javascript_tool`, um Trainings anzulegen.
- **Icons:**
  - Quelle ist `assets/icon-source.png`.
  - `npm run icons` erzeugt die Icons mit dem `@vite-pwa/assets-generator` und verschiebt sie nach `public/`.
- **Router:** Hash-Router mit Overlay-Stack in `src/router.ts`.
  - `bootRouter` startet bei `#/`. Danach öffnet `main.tsx` ein laufendes Training der letzten 12 h (`findRunningSession`), z. B. nach einem PWA-Update-Reload.
  - Jedes offene Sheet hat einen eigenen History-Eintrag. Wer nach dem Schließen eines Sheets navigiert oder ein weiteres öffnet, muss kurz warten, bis dieser Eintrag weg ist (`Menu` macht das mit `setTimeout(…, 30)`). `navigate`/`goBack` puffern Aufrufe, solange `ignorePop > 0` ist.
- **DB-Schema:** Dexie-Version 2 (Tabelle `snapshots` für die Sicherung vor dem Überschreiben). Neue Tabellen oder Indizes brauchen eine neue `this.version(n)`.
- **Datensätze:** Jeder Datensatz hat `id`, `createdAt`, `updatedAt` und `deletedAt` (Soft Delete), als Vorbereitung für den Sync.
- **Seed-Migrationen:**
  - `SEED_VERSION` in `src/db.ts` steht aktuell auf 7.
  - Neue Standard-Übungen oder Optionen werden als neuer `migrate(from)`-Schritt ergänzt.
- **Themes:**
  - Die Farben sind CSS-Tokens auf `:root` in `src/styles.css`. Overrides laufen über `<html data-theme="black-blue|white-blue|oscar-wyld">`.
  - Die Logik steckt in `src/theme.ts`.
  - Die Auswahl wird in den Settings gespeichert und zusätzlich in `localStorage` gespiegelt (`falsegrip.theme`).

### Wichtige Dateien

| Datei | Inhalt |
|---|---|
| `src/model.ts` | Typen; `FIELD_ORDER` (Weight, Time, Reps: Reps immer rechts); `bwPctOf`; Superset-Helfer (`groupSupersets`, `linkWithNext`, `unlink`, `splitAfter`, `normalizeSupersets`) |
| `src/db.ts` | DB, Starter-Bibliothek, `STRETCH_OPTIONS`, Migrationen, `exportBackup`/`parseBackup` (prüft die Struktur) |
| `src/importBackup.ts` | `mergeBackup` (Abgleich nach Inhalt), `overwriteWithBackup` (legt vorher einen Snapshot an), `restoreSnapshot` |
| `src/backup.ts` | `downloadBackup`, monatliche Erinnerung `shouldRemindBackup`, `shouldAskUsername` (alle ~60 Tage, solange kein Name gesetzt ist) |
| `src/sessions.ts` | Trainingslogik, `startSession` (setzt `user`), `saveAsTemplate(overwrite?)`, `findTemplateByName`, Bestleistungen (`buildHistory`, `personalRecords`), `findRunningSession` |
| `src/stats.ts` | Metriken, `buildSeries`, `sessionTotals` (Nebenmuskelgruppen zählen halb), `buildCsv` (erste Spalte `user`), `fileUser` |
| `src/timer.ts` | Globaler Timer; Klaviersynthese per Web Audio (`pianoNote`), siehe unten |
| `src/components/LineChart.tsx` | SVG-Chart: Tippen zeigt den Wert oben, Maus-Hover zeigt einen Tooltip neben dem Punkt |
| `src/components/BackupReminder.tsx` | Start-Popups: höchstens eins pro Start; ein fälliges Backup hat Vorrang vor der Frage nach dem Namen |

## Stand der Funktionen

### Training
- **Trainings:** aus Vorlagen oder frei.
- **Supersets:** Die Übungen bekommen einen Rahmen. Verbinden und Lösen geht über das Übungsmenü und im Vorlagen-Editor.
- **Start- und Endzeit:** Ein Tippen auf den Trainingsnamen klappt Start/Ende (zwei Zeiteingaben) und die Notiz auf bzw. zu.
- **Löschen:** Beim Entfernen einer Übung fragt die App nach, im Training und in der Vorlage.
- **Vorlagen:** Gibt es schon eine Vorlage mit demselben Namen, fragt die App „Überschreiben“ oder „Als neue Vorlage speichern“.
- **Bestleistungen:** Ein 🏆 an der Satznummer, wenn kein früherer Satz derselben Übung/Stufe in allen erfassten Feldern mindestens gleich gut war (Pareto-Vergleich, z. B. mehr Reps beim selben Gewicht oder mehr Gewicht). Frühere Sätze im selben Training zählen mit, L/R getrennt. Nur Gewicht ohne Reps/Zeit zählt nicht, beim allerersten Mal gibt es keinen Pokal.
- **Fortsetzen:** Beim App-Start springt die App in ein laufendes Training der letzten 12 h.

### Übungen
- **Körpergewicht-Anteil:** `bwPct` lässt sich im Übungseditor einstellen.
  - Pull-up, Dip, Muscle-up, L-Sit, Front Lever usw.: 100 %
  - Push-up 70 %, Pike 75 %, Body Row 55 %, Hanging Leg Raise 35 %, Sissy Squat 80 %
  - Langhantel, Kurzhantel und Maschine: 0 %
- **Front Lever:** Alle Varianten erfassen standardmäßig Reps und Zeit.
- **Stretching-Optionen:** Good Mornings, Hip Flexors, Log Sit, Baby Pose, Hamstrings, Chest, Lats, Pancake, Tailor Pose, Front Split, Side Split, Bridge, German Hang, Dead Hang, Wrist, Shoulders.

### Statistik
- **Volumen** gibt es pro Übung. Die Formel ist (KG × bwPct + Zusatzgewicht) × Reps. Bei reinen Halteübungen wird mit Sekunden statt Reps gerechnet (kg·s).
- **e1RM** (Epley) rechnet mit der Gesamtlast KG × bwPct + Zusatzgewicht, bei Gym-Übungen (bwPct 0) also nur mit dem Hantelgewicht. „Max. Gewicht“ bleibt das eingetragene Gewicht.
- Ohne eingetragenes Körpergewicht zeigen Volumen und Gesamt einen Hinweis.
- **Vergleich:** Mehrere Übungen in einem Chart, nur bei gleichen Dimensionen.
- **Ansicht „Gesamt“:** Volumen pro Training und pro Muskelgruppe. Die primäre Gruppe zählt 100 %, Nebengruppen 50 %.
- **CSV-Export:** Spalte `user`, der Benutzername steht auch im Dateinamen.

### Timer
- Countdown und Stoppuhr.
- Bei 3‑2‑1 kommt je ein kurzes Klavier-F4 (349,2 Hz).
- Am Ende rollt ein Klavierakkord F4–A4–C5–E5–F5 an. Die Töne setzen 40 ms versetzt ein und klingen nach etwa 2,2 s gemeinsam aus.
- Der Signalton lässt sich mit dem Chip „🔔 Signalton an/aus“ schalten. Beim Einschalten spielt der Akkord einmal zum Testen.
- Audio wird bei jedem Tippen entsperrt.
- Der Nutzer hat den Klang lange abgestimmt. **Nicht ungefragt ändern.**

### Einstellungen
- **Aussehen:** Petrol & Orange (Standard), Schwarz & Blau, Weiß & Blau (hell), Oscar & Wyld (Pink auf neutralem Dunkelgrau).
- **Benutzername:**
  - Wird in neue Trainings und in Backups geschrieben.
  - Ist kein Name gesetzt, fragt ein Popup beim ersten Start danach, dann etwa alle 2 Monate wieder.
- **Backup:**
  - Export als JSON, Dateiname mit Benutzername.
  - Beim Import fragt die App „Kombinieren“ oder „Überschreiben“. Gehört das Backup einem anderen Nutzer, erscheint eine Warnung.
  - Die Datei wird beim Import auf ihre Struktur geprüft.
  - Vor „Überschreiben“ sichert die App den bisherigen Stand in der Tabelle `snapshots`. In den Einstellungen erscheint dann „Früheren Stand wiederherstellen“. Wiederherstellen tauscht die beiden Stände, ist also selbst rückgängig zu machen.
  - Beim Kombinieren werden Übungen über den Namen abgeglichen (Stufen ebenfalls über den Namen, IDs werden umgemappt). Trainings gelten als gleich bei gleichem Namen und Startzeit ±2 min, Vorlagen bei identischem Inhalt.
- **Backup-Erinnerung:** monatlich beim ersten App-Start des Monats. Dazu ein Hinweis ganz unten.
- **Teilen:** Der Button „App teilen“ kopiert den Link zur App.

## Offen / Ideen

- **Phase 3 (online):** Vorschlag ist Supabase in der EU-Region (Frankfurt), in drei Stufen: 3a Sync, 3b Freunde, 3c Live-Ansicht.
  - Der Nutzer hat sich noch nicht entschieden.
  - Dafür braucht es von ihm: Project-URL und anon key (**nie** den service_role key), die Login-Methode und wer sich registrieren darf.
  - Der Benutzername und die Soft-Delete- und `updatedAt`-Felder sind darauf schon vorbereitet.
- **Einschränkungen auf dem iPhone:**
  - Im Lautlos-Modus ist der Web-Audio-Ton stumm.
  - Bei gesperrtem Bildschirm läuft kein Timer-Ton. Ein WakeLock hält den Bildschirm an, solange der Timer offen ist.
