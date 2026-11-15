# Falsegrip: Produktspezifikation (v0.4)

Working Title: **Falsegrip**
Status: Weitgehend entschieden. Eine offene Frage in Abschnitt 12.
Die Screenshots der Referenz-App dienen nur als Inspiration (Abschnitt 9). Bei Widersprüchen gilt dieses Dokument.

---

## 1. Ziel und Kontext

- Persönlicher Trainings-Tracker, primär für **Calisthenics** (Bar, Rings, Bodyweight, Hebel/Progressionen, teils mit Gewichtsgurt).
- Sekundär für **Gym-Training**, vor allem Beine (Deadlift, Squat, Lunges) und gelegentlich Kurzhantelübungen (z. B. Dumbbell Shoulder Press).
- Hauptnutzer: ich selbst. Später: eine kleine Gruppe Freunde in verschiedenen Städten.
- Leitprinzip: **Im Training möglichst wenig Zeit am Handy.** Jede Eingabe mit minimalen Taps.
- Stil: minimalistisch, clean, **nur Dark Mode**.
- **Übungsnamen auf Englisch** (kürzer und in der Szene üblich), z. B. "Pull-up", "Ring Dip", "Tuck Front Lever", "Deadlift", "Lunge".

---

## 2. Plattform

- **Web-App**, auf dem Handy-Homescreen installierbar (Progressive Web App).
- Primäres Testgerät: **Android**. iPhone soll funktionieren, ist aber zweitrangig.
- Muss **offline** voll funktionieren.
- Daten im MVP lokal im Browser-Speicher des Geräts.
- iPhone-Hinweis: Die App sollte zum Homescreen hinzugefügt werden. Laut WebKit haben Homescreen-Web-Apps einen eigenen Nutzungszähler und sind nicht von der 7-Tage-Regel für Safari-Websites betroffen (Quelle: https://www.theregister.com/2020/03/26/apple_relax_were_not_totally/). Zusätzlich persistenten Speicher anfordern (`navigator.storage.persist()`), da persistente Origins von automatischer Löschung ausgenommen sind (Quelle: https://webkit.org/?p=14403).
- **Backup-Export und -Import als Datei** gehören ins MVP, weil lokaler Browser-Speicher bei Gerätewechsel oder gelöschten Browserdaten verloren geht.

---

## 3. Prioritäten

| Phase | Inhalt |
|---|---|
| **MVP** | Training erfassen (leer oder aus Vorlage), Sätze mit konfigurierbaren Feldern, uni-/bilaterale Übungen, Vorschlagswerte (ausgegraut) + Swipe zum Übernehmen, Swipe zum Löschen, Trainingsliste, Übungs- und Vorlagenverwaltung inkl. Progressionen, Timer, Backup-Export/Import |
| **Phase 2** | Statistik-Screen mit wählbaren Kennzahlen und Verlaufsgrafiken, CSV-Export |
| **Phase 3** | Accounts, Online-Sync, Daten mit Freunden teilen, Live-Ansicht "was trainiert mein Freund gerade" |

Das Datenmodell muss von Anfang an Sync und Mehrbenutzerbetrieb vorbereiten (eindeutige IDs, Änderungszeitstempel), damit Phase 3 keinen Umbau erfordert.

---

## 4. Inhaltliches Datenmodell

### 4.1 Übung (Exercise)
- Name (Englisch)
- Muskelgruppe(n)
- Equipment: Bar / Rings / Floor / Barbell / Dumbbell / Machine / Other
- **Felder pro Satz** (frei kombinierbar, mindestens eins):
  - Zusatzgewicht bzw. Gewicht (kg)
  - Reps
  - Zeit (Sekunden)
- **Seitigkeit**: bilateral / unilateral
- Optional: **Progressionsstufen** (siehe 4.2)
- **Letzte Werte** werden an der Übung (bzw. Progressionsstufe) geführt, unabhängig vom Training oder der Vorlage. Gespeichert pro Satznummer und bei unilateralen Übungen pro Seite.

Typische Feldkombinationen als Vorlagen beim Anlegen einer Übung:

| Kombination | Beispiele |
|---|---|
| Reps | Push-up, Pull-up, Leg Raise |
| Gewicht + Reps | Deadlift, Squat, Dumbbell Shoulder Press, Weighted Pull-up |
| Zeit | Tuck Front Lever, L-Sit, Handstand Hold |
| Gewicht + Zeit | Weighted Front Lever Hold |
| Reps + Zeit | Front Lever Raises mit Hold, Tempo-Reps, z. B. 5 Reps x 3 s |

Gewicht bedeutet bei Bodyweight-Übungen immer **nur Zusatzgewicht**. Bei Gym-Übungen ist es das bewegte Gewicht.

### 4.2 Progressionsstufen
- Eine Übung kann optional mehrere **Progressionsstufen** in fester Reihenfolge haben.
  Beispiel "Front Lever": Tuck, Advanced Tuck, One Leg, Straddle, Full.
- Jede Stufe wird im Training wie eine eigene Übung behandelt (eigene Sätze, eigene letzte Werte, eigener Verlauf).
- Auch Erleichterungen wie Negatives oder unterstützte Varianten werden als Stufe angelegt. Es gibt **keine** gesonderte Band-/Assistenz-Erfassung.
- Stufen werden **nur im Übungs-Screen** (Tab 2) angelegt und bearbeitet.
- Jede Stufe hat einen **Intensitätswert in Prozent** (höchste Stufe = 100 %).
  - Die App **schlägt Standardwerte automatisch vor**, gleichmäßig verteilt über die Anzahl der Stufen (Vorschlag, siehe F2).
  - Bearbeitbar in den Übungsdetails, aber unauffällig. Der Nutzer muss sich nie damit befassen, damit die App funktioniert.
  - Änderungen wirken rückwirkend auf die Statistik.

### 4.3 Workout-Vorlage (Template)
- Name (z. B. "Leg Day", "Calisthenics Push", "Calisthenics Pull", "Calisthenics Full Body")
- Geordnete Liste von Übungen (bzw. Progressionsstufen)
- Pro Übung: **Anzahl Sätze** (meist 3), optional Zielwerte

### 4.4 Training (Session)
- Datum und Startzeit (automatisch beim Start)
- Endzeit (beim Beenden)
- Name (vorbelegt mit Vorlagenname, sonst "Freies Training")
- Verwendete Vorlage (oder leer)
- Notiz zum Training (optional)
- Geordnete Liste von Übungsblöcken

### 4.5 Satz (Set)
- Satznummer innerhalb der Übung
- Werte gemäß den Feldern der Übung
- Bei unilateralen Übungen: **getrennte Werte für Links und Rechts**
- Notiz (optional, Freitext)
- Status: ausgefüllt / leer (nur Vorschlagswert sichtbar)

Notizen gibt es nur **pro Satz** und **pro Training**, nicht pro Übung.

### 4.6 Körpergewicht
- Ein einziges Feld in den **Einstellungen**, optional, jederzeit änderbar.
- Wird beim Speichern eines Satzes still mitgespeichert (für spätere Auswertungen), erscheint aber **nirgends im Training**.
- Geringe Priorität.

---

## 5. Navigation: 3 Haupt-Screens

Untere Tab-Leiste mit drei Tabs. App startet immer auf Tab 1.

1. **Trainings** (Startseite, wichtigster Screen)
2. **Übungen & Vorlagen**
3. **Statistik**

Zusätzlich Vollbild-Screens: **Aktives Training** und **Timer**.

---

## 6. Screens im Detail

### 6.1 Tab 1: Trainings (Startseite)
- Chronologische Liste, **neuestes oben**.
- Ca. 4 bis 5 Einträge ohne Scrollen sichtbar.
- Gruppierung nach Monat, Überschrift mit Anzahl Trainings.
- Datum links neben der Karte (Wochentag, Tag, Monat).
- Karte: Name, Dauer, Übungen mit Satzanzahl ("3x Deadlift").
- Tap öffnet das Training. **Vergangene Trainings sind voll bearbeitbar und löschbar.** Trainings können auch nachträglich angelegt werden.
- **Floating-Action-Button "+" unten rechts**: neues Training starten.

### 6.2 Training starten
- Datum und Startzeit automatisch gesetzt.
- Auswahl als Bottom Sheet:
  1. **"Freies Training"** (immer ganz oben)
  2. Darunter die Vorlagen
- Ein Tap startet sofort.

### 6.3 Aktives Training
- Oben kompakt: Name, Datum, Startzeit, Trainingsnotiz (einklappbar).
- Oben rechts **"..."-Menü des Trainings** mit u. a.:
  - **Übungen neu sortieren** (eigener Sortiermodus). Änderungen betreffen nur dieses Training, **nie die Vorlage**.
  - Training löschen
- Timer-Icon im Kopfbereich (siehe 6.6).
- Übungen als **Karten untereinander**.
- Jede Karte:
  - Kopf: Übungsname, rechts **"..."-Menü** (u. a. **Übung löschen**, Übung tauschen)
  - Sätze zeilenweise, Satznummer im Kreis links
  - Spaltenreihenfolge: **Gewicht (+kg), dann Reps, dann Zeit, dann Notiz**. Es werden nur die Spalten angezeigt, die die Übung konfiguriert hat.
  - **Unilateral**: Pro Satz zwei Zeilen, "L" und "R", direkt untereinander unter derselben Satznummer.
  - Unter dem letzten Satz: **"Satz hinzufügen"**
  - Fußzeile mit Icons: **Verlauf** dieser Übung und **Mini-Statistik** dieser Übung (öffnen jeweils ein Overlay, ohne das Training zu verlassen)
- Unter der letzten Karte: Button **"Übung hinzufügen"** (Suche, Auswahl auch einer konkreten Progressionsstufe).
- Unten rechts: **"Training beenden"**.
- Beim Beenden: Ist das Training **komplett leer** (kein einziger ausgefüllter Satz), wird es ohne Nachfrage gelöscht.

#### Vorschlagswerte (Kernfeature)
- Beim Start aus einer Vorlage werden alle Übungen mit der **Satzanzahl aus der Vorlage** angelegt, Sätze leer.
- Leere Felder zeigen einen **ausgegrauten Vorschlagswert**.
- Quelle per Toggle in den Einstellungen:
  - **Standard: letzte Werte der Übung** (pro Satznummer, pro Seite)
  - Alternative: Zielwerte aus der Vorlage
- Zusätzlicher Satz (z. B. Satz 4): Vorschlag aus dem letzten Satz 4 dieser Übung. **Gab es nie einen Satz 4, bleibt er leer.**
- Gilt auch im freien Training.

#### Gesten auf einer Satzzeile
- **Tap ins Feld**: eigene Zahl eintippen.
- **Swipe nach rechts**: Vorschlagswerte der Zeile werden übernommen.
- **Swipe nach links**: Rechts erscheint ein rotes Löschen-Symbol. Erst ein Tap darauf löscht den Satz. Tap woanders schließt die Zeile wieder.
- Bei unilateralen Übungen wirken die Gesten pro Zeile (L oder R einzeln).

### 6.4 Tab 2: Übungen & Vorlagen
- Segment-Umschalter oben:
  - **Übungen**: gruppiert nach Muskelgruppe, Übungen mit Progressionen als aufklappbare Gruppen, Suche, Übung anlegen/bearbeiten (Name, Muskelgruppe, Equipment, Felder, uni/bilateral, Progressionsstufen inkl. Intensität %)
  - **Vorlagen**: Liste, anlegen, Übungen hinzufügen, sortieren, Satzanzahl festlegen

### 6.5 Tab 3: Statistik
- Übung auswählen (bei Progressionen: ganze Übung oder einzelne Stufe), dann Verlaufsgrafik.
- **Kennzahl frei wählbar** per Auswahl über der Grafik:

| Übungsart | Wählbare Kennzahlen |
|---|---|
| Reps | Max. Reps in einem Satz, Gesamt-Reps pro Training, Ø Reps pro Satz |
| Gewicht + Reps | Max. Gewicht, Volumen (Reps x Gewicht), geschätztes 1RM, Max. Reps bei gegebenem Gewicht |
| Zeit | Längste Haltezeit, Gesamthaltezeit pro Training |
| Progressionen (ganze Übung) | **Haltezeit x Intensität %** über alle Stufen hinweg |
| Einzelne Stufe | Haltezeit (bzw. Reps) im Verlauf, nur diese Stufe |
| Unilateral | Links und rechts als zwei Linien |

- Zeitraum wählbar (1 Monat, 3 Monate, 1 Jahr, alles).
- Grafik schlicht, dezent animiert.
- **CSV-Export** aller Rohdaten, ein Satz (bzw. eine Seite) pro Zeile:
  `date, start_time, session_id, session_name, template, exercise, progression_level, intensity_pct, side, set_no, weight_kg, reps, time_s, bodyweight_kg, note`

### 6.6 Timer
- Allgemeiner Timer, aufrufbar aus dem aktiven Training (Icon im Kopfbereich).
- Modi: **Stoppuhr** (hochzählend) und **Countdown** (z. B. für Pausen).
- **Vollbildmodus** mit großer Anzeige, z. B. für Handstand Holds.
- Der Timer **speichert nichts in Sätze**. Werte trägt man selbst ein, weil die gestoppte Zeit oft ein paar Sekunden zu lang ist.
- Timer wird nicht geloggt.

---

## 7. Einstellungen (minimal)
- Vorschlagswerte: "letzte Werte" / "Zielwerte"
- Körpergewicht (optional)
- Backup exportieren / importieren
- Einheit: kg

---

## 8. Design- und UX-Prinzipien
- Nur Dark Mode, eine Akzentfarbe für Aktionen.
- Minimalistisch, große Touch-Ziele (Bedienung mit verschwitzten Händen).
- Häufige Aktionen mit einem Tap oder Swipe.
- Keine Pflichtfelder außer dem Nötigsten.
- Ein laufendes Training darf **nie verloren gehen**. Jede Eingabe wird sofort gespeichert, auch bei Schließen oder Neuladen.

---

## 9. Referenz-App: Was übernehmen, was ändern

**Übernehmen**
- Drei Tabs (Tagebuch, Trainingspläne, Statistik).
- Trainingsliste mit Monatsüberschrift + Anzahl, Datum links, Karte mit Name, Dauer, "3x Übung".
- FAB "+" unten rechts.
- Dunkles Design mit Türkis als Akzentfarbe.
- Übungskarte mit Satznummer im Kreis, ausgegraute Vorschlagswerte.
- Spaltenreihenfolge "+Kg" vor "Reps".
- "Satz hinzufügen" als Textlink unter den Sätzen, "Übung hinzufügen" als großer Button.
- Icons in der Übungskarte für Verlauf und Statistik.

**Anders machen**
- Kein Körpergewicht-Feld pro Training (nur in den Einstellungen).
- Spalten strikt nach Konfiguration der Übung. Kein "+Kg"-Feld bei Übungen ohne Gewicht.
- "Beenden" **unten rechts** statt oben links.
- Kopfbereich kompakt bzw. einklappbar statt halber Bildschirm.
- Leere Trainings werden automatisch gelöscht statt in der Liste angezeigt.
- Kein Stern-/Favoriten-Icon, sofern nicht später gewünscht.

---

## 10. Phase 3: Social / Freunde
- Account erstellen, Daten online synchronisieren.
- Freunde hinzufügen, eigene Trainings und Statistiken freigeben.
- Trainings und Fortschritt der Freunde ansehen.
- **Kein Chat.**
- Optional: Live-Ansicht eines laufenden Trainings eines Freundes.

### Nicht im Scope
- Chat, Kommentare
- Ernährungstracking
- Gamification, Badges, Streaks
- Aufwärmsätze als eigene Kategorie
- Band-/Assistenz-Erfassung (stattdessen Progressionsstufen)
- Supersätze / Zirkel

---

## 11. Sprache und Starter-Bibliothek

### 11.1 Sprache
- **Oberfläche (Menüs, Buttons, Screens): Deutsch.** Texte zentral ablegen, damit später eine englische Oberfläche ohne Umbau möglich ist.
- **Übungsnamen: Englisch.**

### 11.2 Starter-Bibliothek
Beim ersten Start ist eine kleine Bibliothek mit Grundübungen vorhanden. Alles ist bearbeitbar und löschbar. Weitere Übungen legt der Nutzer selbst an.

| Übung | Felder | Seitigkeit | Progressionsstufen |
|---|---|---|---|
| Pull-up | Gewicht + Reps | bilateral | |
| Chin-up | Gewicht + Reps | bilateral | |
| Dip | Gewicht + Reps | bilateral | |
| Ring Dip | Gewicht + Reps | bilateral | |
| Push-up | Gewicht + Reps | bilateral | |
| Pike Push-up | Reps | bilateral | |
| Ring Row | Reps | bilateral | |
| Hanging Leg Raise | Reps | bilateral | |
| L-Sit | Zeit | bilateral | Tuck, One Leg, Full |
| Front Lever | Zeit | bilateral | Tuck, Advanced Tuck, One Leg, Straddle, Full |
| Handstand Hold | Zeit | bilateral | Wall, Freestanding |
| Deadlift | Gewicht + Reps | bilateral | |
| Squat | Gewicht + Reps | bilateral | |
| Lunge | Gewicht + Reps | unilateral | |
| Dumbbell Shoulder Press | Gewicht + Reps | bilateral | |

- Standard-Intensität: gleichmäßig über die Stufen verteilt, höchste Stufe = 100 %. Bei 5 Stufen also 20 / 40 / 60 / 80 / 100 %, bei 3 Stufen 33 / 67 / 100 %. Das ist eine bewusst einfache Annahme, keine sportwissenschaftliche Abstufung.
- Gewicht bei Bodyweight-Übungen ist optional (Zusatzgewicht). Leeres Feld = 0 kg.
- Starter-Vorlagen: keine. Der Nutzer legt seine Vorlagen selbst an (Leg Day, Calisthenics Push usw.).

## 12. Offene Fragen

- F3. **Relative Strength**: Siehe Abschnitt 12. Soll es eine Kennzahl "(Körpergewicht + Zusatzgewicht) / Körpergewicht" für gewichtete Bodyweight-Übungen geben, gespeist aus dem Wert in den Einstellungen?
  Antwort:

---

## 13. Kritische Punkte und Risiken

- **Relative Strength vs. kein Körpergewicht**: Relative Kraft bei gewichteten Übungen wie Weighted Pull-ups ergibt sich aus Gesamtlast im Verhältnis zum Körpergewicht. Ohne Körpergewicht zeigt die App nur das Zusatzgewicht. Das reicht, solange sich das Körpergewicht kaum ändert. Der Wert aus den Einstellungen deckt das ab, muss aber gelegentlich aktualisiert werden, sonst wird die Kennzahl falsch.
- **Intensitäts-Prozente** sind keine objektive Größe. Es gibt keinen anerkannten Standard, wie viel schwerer eine Stufe als die vorherige ist. Die Standardwerte sind Schätzungen. Die Kennzahl "Haltezeit x Intensität" ist nur so aussagekräftig wie diese Werte.
- **Lokale Daten in einer Web-App**: Gelöschte Browserdaten oder Gerätewechsel bedeuten Datenverlust. Bis Phase 3 schützt nur der Backup-Export.
- **Swipe-Gesten in einer Web-App** können mit Browser-Gesten kollidieren (Zurück-Wischen vom Rand bei Android). Auf dem echten Gerät testen.
- **Unilaterale Übungen** verdoppeln die Zeilen pro Übungskarte. Bei 3 Sätzen sind es 6 Zeilen. Die Karte darf dadurch nicht unübersichtlich werden.
- **Phase 3** (Accounts, Sync, Live-Ansicht) ist deutlich aufwendiger als MVP und Phase 2 zusammen. Erst angehen, wenn die App für dich allein stabil läuft.
