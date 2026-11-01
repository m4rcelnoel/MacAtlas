# Änderungen

Deutsche Fassung von [CHANGELOG.md](CHANGELOG.md) – wird in MacAtlas unter Einstellungen → *Was ist neu* angezeigt.

## 1.3.1

- Erstes veröffentlichtes Release der Änderungen aus 1.3.0 (der 1.3.0-Build wurde durch einen fehlgeschlagenen UI-Test gestoppt und nie veröffentlicht).

## 1.3.0

- Auswahl per Häkchen in Vergleich, Umzug, Updates und Speicherplatz: Installations-, Update- und Aufräumskripte enthalten nur angehakte Einträge. Jede Gruppe hat *Alle*/*Keine*, die Auswahl wird gemerkt.
- Detailansicht: Ein Klick auf einen Eintrag zeigt Update, Befehle zum Installieren, Aktualisieren und Deinstallieren mit Kopier-Buttons, die Notiz und alle bekannten Infos.
- Listen lassen sich filtern (mit Update, Homebrew, App Store, ohne Paketquelle, mit Notiz, nur Intel, ungenutzt), nach Name, Größe, letzter Nutzung oder Quelle sortieren und durchsuchen.
- Updates, Aufräumen und Umzugsschritte laufen direkt in MacAtlas statt in einem Terminal-Fenster: Live-Ausgabe, Fortschritt, Abbrechen, Fehlerübersicht und automatischer Neu-Scan. Für sudo erscheint der Passwortdialog von macOS. *Im Terminal* bleibt als Alternative.
- Schnellsuche (⌘K): springt zu jeder Seite, jedem Eintrag und jeder Aktion.
- Abschnitte der Seitenleiste lassen sich einklappen; ↑/↓ bewegt sich durch Listen (die Detailansicht folgt) und die Seitenleiste; bessere VoiceOver-Beschriftungen und sichtbarer Fokus.
- Beim ersten Start gibt es eine kurze Einführung in drei Schritten und einen Hinweis, wenn die Command Line Tools fehlen.
- Der Scan-Fortschritt zählt live mit, was gefunden wird.
- Einen exportierten Scan einfach aufs Fenster ziehen, um ihn zu öffnen.
- Neue Paketquellen: Rust (`cargo install`), Go-Tools, pipx, uv-Tools, Composer, mise, asdf und MacPorts – inklusive Installationsskript für einen neuen Mac.
- MacAtlas aktualisiert sich selbst: tägliche Prüfung der GitHub-Releases, dann Download, Signaturprüfung, Austausch und Neustart aus den Einstellungen.
- Test-Button für Mitteilungen in den Einstellungen.
- Pakete, die mit dem System mitkommen – Gems des Ruby von macOS, die Default-Gems von Ruby, die Python-Pakete der Command Line Tools – tragen den Tag *System*: Sie bleiben sichtbar, werden aber nie als Update angeboten, nicht ins Installationsskript übernommen und im Vergleich nicht als fehlend gezählt. Fehler wegen fehlender Schreibrechte werden erklärt.
- MacAtlas scannt jetzt das Ruby, das du wirklich benutzt (Homebrew, rbenv, asdf, mise …), statt nur das erste `gem` im PATH, und führt die Updates mit diesem Ruby aus.
- Einstellungen → *Was ist neu* zeigt diese Änderungen, auf Deutsch oder Englisch; nach einem Update öffnet sich das Fenster einmal von selbst.
- Behoben: pip-Pakete, deren Name so lang ist wie die Spalte, wurden mit der Version im Namen gelesen.
- Neues App- und Menüleisten-Symbol.
- UI-Tests mit Playwright in der CI; Releases können einen Homebrew-Tap automatisch aktualisieren.

## 1.2.1

- Einstellungen → Über zeigt App-Symbol, Version und „Made by buddster“ mit Links zu buddster.de, zum Quellcode und zu GitHub-Issues; auch das macOS-Fenster „Über MacAtlas“ nennt buddster.
- Release-Builds versuchen Stapling und Ticket-Prüfung erneut, wenn Apples Ticket-Dienst die Verbindung abbricht.
- README: neuer Installationsabschnitt mit direktem Download-Link, Voraussetzungen, Aktualisieren und Deinstallieren.

## 1.2.0

- Umbenannt von *Mac Inventory* in **MacAtlas**; vorhandene Daten werden beim ersten Start übernommen.
- Neue Seiten: Speicherplatz, Versionen & Doppeltes, Abos & Lizenzen, Einstellungen mitnehmen, Meine Macs, Umzugsassistent.
- Die Sicherheitsseite zeigt jetzt offene Netzwerk-Ports, Systemerweiterungen und Browser-Erweiterungen.
- Diagramme im Verlauf (Speicher, Einträge, Updates, freigebbarer Platz).
- CSV-Export, URL-Schema (`macatlas://scan`, `report`, `csv`, `export`, `open/<seite>`), Warnungen bei Änderungen, Erinnerungen an Abo-Verlängerungen.
- Releases sind mit Developer ID signiert und von Apple notarisiert (lokal über `build.sh`, in der CI über Repository-Secrets).
- Härtung: Renderer in der Sandbox, strikte CSP, blockierte Navigation, IPC-Callbacks bekommen das Event-Objekt nicht mehr.
- Behoben: Major-Updates mit unterschiedlich vielen Versionsteilen wurden nicht erkannt; die Umzugsseite sprang nach einem Scan zurück zum Vergleich; Hintergrund-Scans wechselten weg von einem geöffneten Snapshot; unbehandelter Fehler beim Export eines defekten Snapshots; Quoting-Fehler im Erste-Hilfe-Skript der DMG.
- Unit-Tests, statische Prüfungen und CI mit DMG-Builds und GitHub-Releases.

## 1.1.0

- Einstellungsseite: Sprache (Deutsch/Englisch), Erscheinungsbild, Start bei Anmeldung, Menüleiste, geplante Scans, Mitteilungen, Daten.
- Vollständige englische Übersetzung; Scan lässt sich abbrechen; Fenstergröße und -position werden gemerkt; nur eine Instanz.

## 1.0.0

- Inventar von Programmen, Homebrew, App Store, npm, pip, Gems, VS Code, Docker, Schriften und Claude Code.
- Export/Import und Vergleich zweier Macs mit Installationsskript und Brewfile.
- Updates, Aufräumen, Sicherheit, Autostart, Verlauf, Notizen & Tags, PDF-Bericht, Menüleisten-Symbol.
