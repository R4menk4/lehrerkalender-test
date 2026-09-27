# Mein Lehrerkalender – Browser-Prototyp

Ein responsiver Klick-Prototyp für Android, Windows und iPad. Die veröffentlichte Ausgangsversion enthält ausschließlich neutrale Testdaten. Persönliche Stundenpläne, Namen und Noten werden nur im lokalen Browserspeicher des jeweiligen Geräts abgelegt und noch nicht synchronisiert.

## Lokal testen

Im Projektordner einen statischen Webserver starten:

```powershell
python -m http.server 8080
```

Danach `http://localhost:8080` öffnen.

## GitHub Pages

Der Workflow unter `.github/workflows/pages.yml` veröffentlicht den Inhalt automatisch nach jedem Push auf `main`. Im GitHub-Repository muss unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** ausgewählt sein.

Bei GitHub Free muss das Repository für GitHub Pages öffentlich sein. In das Repository oder dessen Git-Historie gehören deshalb niemals echte Namen, Stundenpläne, Noten, Sicherungsdateien oder andere personenbezogene Daten. Lokal eingegebene Daten werden nicht Teil des Repositorys.

Die GitHub-Veröffentlichung sollte aus einem neuen, bereinigten Commit ohne die lokale Entwicklungshistorie erfolgen. So gelangen auch frühere Teststände nicht nachträglich in ein öffentliches Repository.

## Bereits klickbar

- responsive Navigation für Desktop und Smartphone
- Startseite, Wochenstundenplan und Kursübersicht
- Kursverwaltung mit geteilten Klassenlisten für Sek I und unabhängigen Kurslisten für Sek II
- SuS einzeln ändern oder mehrere Namen gesammelt einfügen
- datierter Wochenstundenplan mit Unterrichtsreihen und automatischer UE-Verteilung
- Statusmarkierungen für ungeplant, geplant, durchgeführt und ausgefallen sowie automatische Verschiebung bei Ausfall oder Rücksetzung
- bis zu zwei UEs in einer Doppelstunde und Hausaufgaben direkt an einzelnen Terminen
- Sammelerfassung der Noten 1–6
- normale Stundenerfassung als mündliche Mitarbeit, optional ersetzbar durch „Sonstige"
- eigener schriftlicher Reiter für Klausuren und Lernchecks
- Einzel-/Doppelstunden-Gewichtung
- dynamische Endnote: mit schriftlicher Leistung 50/40/10, ohne schriftliche Leistung 80/20; fehlende sonstige Leistungen werden nicht verlangt
- ausklappbare vorherige Quartalsnote
- veränderbare pädagogische Endnote
- quartalsweiser Fehlstundenabgleich
- lokale Sicherungserinnerung
- optionaler PIN-Blickschutz
- optionale Zusatzfunktionen hinter einem Drei-Punkte-Menü
