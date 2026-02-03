
# MLS Messaging System — Architektur & Projektübersicht

Dieses Repository implementiert ein sicheres, multi-device Messaging-System, das die Messaging Layer Security (MLS) für End-to-End-Verschlüsselung (E2EE) nutzt und das "Inbox Pattern" zur zuverlässigen Zustellung und Synchronisation über mehrere Geräte unterstützt.

## Ziel des Projekts

- Bereitstellung einer skalierbaren, sicheren Messaging-Plattform für Gruppen- und 1:1-Kommunikation.
- Unterstützung mehrerer Geräte pro Benutzer mit konsistenter, lückenfreier Synchronisation.
- Effiziente Gruppenverschlüsselung mittels MLS (statt vieler 1:1-Ratchets).

## High-Level Tech Stack

| Kategorie | Technologie |
| :--- | :--- |
| **Backend** | Elysia.js (TypeScript) API + Worker Nodes |
| **Kommunikation** | REST (Upstream) + WebSockets (Downstream/Push) |
| **Event Bus** | Kafka (Async Verarbeitung & Fan-out) |
| **Storage** | PostgreSQL (Metadata/Inbox), Redis (Pub/Sub für Push), S3 (Media/Backups) |
| **Security** | Argon2 (Passwort-Hashing), Ed25519 (Identität), AES-GCM (Payloads) |

## Kernkonzepte

### Messaging Layer Security (MLS)

MLS ermöglicht effiziente Gruppenverschlüsselung für große Gruppen (z. B. >1000 Mitglieder). Wichtige Begriffe:

- **KeyPackages**: Pre-Keys, die Clients hochladen, damit andere sie bei Offline-Mitgliedern verwenden können.
- **Epochs**: Jede Gruppenänderung (Add/Remove/Leave) erzeugt eine neue Epoch durch eine `Commit`-Nachricht.
- **Epoch Konsistenz**: Clients können Nachrichten aus Epoch N+1 nicht entschlüsseln, bevor sie die `Commit`-Nachricht verarbeitet haben, die den Übergang zu Epoch N+1 ermöglicht. Lücken sind nicht zulässig.
- **Welcome Messages**: Werden neuen Mitgliedern gesendet, um den aktuellen Gruppenstatus bereitzustellen.

### "Inbox Pattern" (Fan-out)

Zur Unterstützung mehrerer Geräte und zuverlässiger Sync verwenden wir ein zweistufiges Speicher-/Zeitleistenmodell:

| Konzept | Beschreibung |
| :--- | :--- |
| **Global Messages** | Verschlüsselter Payload wird einmal abgelegt (Source of Truth). |
| **User Inbox** | Leichte Pointer-Tabelle; jede Nachricht wird für jedes Empfängergerät in die Inbox gefanned. |
| **Sequence IDs (`seq_id`)** | Monotoner Zähler pro Benutzer zur Erkennung von Lücken und Wiederherstellung. |

## Logischer Ablauf

### Versenden einer Nachricht

1. **Client**: verschlüsselt Payload lokal und POSTet zu `/messages/send`.
2. **API**: validiert und schreibt ein `MessageEvent` in Kafka.
3. **Worker**: schreibt in `global_messages`, ermittelt Gruppenmitglieder und deren Geräte und fügt für jedes Zielgerät eine Zeile in `user_inbox` ein; veröffentlicht ein Redis-Event, um Pushs anzustoßen.
4. **WebSocket Gateway**: empfängt das Redis-Event und pusht an aktive Verbindungen.

### Synchronisation

- **Live**: Nachrichten kommen per WebSocket.
- **On Connect**: Client sendet letzten `seq_id`; Server liefert alle fehlenden Inbox-Items (Anwendungsnachrichten und Handshake/Commit-Nachrichten).
- **Gap Recovery**: Erhält ein Client eine Nachricht für eine zukünftige Epoch (Orphan), puffert er die Nachricht lokal, fordere fehlende Commit-Nachrichten/Handshake-Historie an und entschlüsselt die Nachricht nach Aktualisierung des Crypto-Status.

## Client-seitige Architektur (Device State)

Um Offline-Lücken und Out-of-Order-Delivery ohne UI-Blockade zu handhaben, verwendet der Client eine "Fast-Forward"-Strategie mit zwei lokalen Stores:

| Komponente | Zweck | Aufbewahrung |
| :--- | :--- | :--- |
| **Skipped Key Store** | Speichert abgeleitete Message-Keys während eines Ratchet-Fast-Forwards (z. B. Msg5 vor Msg4). | Löschung nach Nutzung; Auto-Delete: TBD |
| **Orphan Buffer** | Puffert verschlüsselte Payloads, die zu einer zukünftigen Epoch gehören. | Aufbewahrung bis `history_fetch` fehlende Handshake/Commit-Messages liefert |

## Datenbankschema (Highlights)

| Tabelle | Zweck |
| :--- | :--- |
| `users` | Identity-Keys und globales `last_assigned_seq_id`. |
| `devices` | Mehrere Geräte (phone, desktop) pro Benutzer. |
| `key_packages` | Einmalige MLS Pre-Keys für Gruppen-Init. |
| `global_messages` | Source of Truth für verschlüsselte Blobs. |
| `user_inbox` | Delivery Queue; Typen: `APPLICATION` (Chat) und `HANDSHAKE` (Gruppen-Status). Muss strikt nach `seq_id` geordnet sein. |

## Wichtige Infrastruktur-Komponenten

| Komponente | Rolle |
| :--- | :--- |
| **Kafka Workers** | Entkoppeln HTTP-Request vom teuren Fan-out; berechnen Gruppenmitglieder, schreiben DB und erzeugen Inbox-Einträge. |
| **Redis Pub/Sub** | Verbindung zwischen Backend-Worker und WebSocket-Gateway; weckt Gateway-Node mit Verbindungen des Benutzers auf. |
| **S3 (Object Storage)** | Speicherung großer Binärdateien und verschlüsselter Backups; Messaging-Fluss überträgt nur S3-Keys/Metadaten. |

## Entwicklung & Lokales Setup (Kurz)

Dieses Monorepo enthält mehrere Apps (API, Web, WebSocket, Worker). Übliche Schritte zum Entwickeln:

1. Abhängigkeiten installieren (z. B. für die REST-API):

```
cd apps/rest
bun install
bun run dev
```

1. Die Website in `apps/website` läuft mit Next.js:

```
cd apps/website
bun install
bun run dev
```

1. Dienste wie Kafka, Redis, Postgres und ein S3-Emulator können über `docker-compose.dev.yml` gestartet werden.

Prüfe die `package.json`-Skripte in den jeweiligen App-Ordnern für projektspezifische Befehle.
