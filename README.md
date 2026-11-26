# ptero-js — Pterodactyl Panel (Node.js + Java Edition)

A fast, lightweight, single-process **Node.js + TypeScript** edition of **Pterodactyl Panel v1.15.2**. Designed for **Docker VPS hosts, non-systemd Linux containers, and low-spec servers** — with zero PHP, Nginx, Redis, or Wings setup required.

> **Based on:** [Pterodactyl Panel v1.15.2](https://pterodactyl.io) ([github.com/pterodactyl/panel](https://github.com/pterodactyl/panel))  
> **Created by:** **Sourajitvfx (SOURAJITVFX 2026)**

---

## Key Features

- **Single-Process & Lightweight** — Runs directly with Node.js + Express + WebSocket (`npm start` / PM2). No `systemd`, PHP, Redis, or nested Docker required.
- **Classic Pterodactyl UI** — Preserves the familiar v1.15.2 Client React Panel (Console, Files, Backups, Schedules, Startup, Users, Account) and AdminLTE Admin Panel.
- **Auto Java & Tuned Minecraft Performance** — Automatically manages Java **8, 11, 17, 21, 25, and 26**, applies **G1GC + fast-join network flags**, sets balanced `server.properties` defaults, and logs both `container@pterodactyl~` and `container@SOURAJITVFX~` console banners.
- **Unlimited Large File Uploads (`.part` Resumable)** — Uploads large files part-by-part without `413` size limits. Dropped connections keep `.part` files in File Manager so you can resume anytime from the `...` menu (manual cancel cleans up automatically).
- **Unlimited (`0`) Resource Mode** — Set RAM, CPU, Disk, Backups, Databases, or Allocations to `0` for `Unlimited` (auto-omits `-Xmx` on launch).
- **SQLite or MySQL/MariaDB** — Works out-of-the-box with zero-config SQLite or scales with MySQL 8+ / MariaDB 10.6+.

---

## Quick Start

Run the interactive installer on Linux / Docker VPS:

```bash
git clone https://github.com/Rdx690/ptero-js
cd ptero-js
bash install.sh
```

The installer sets up **Node.js 22+**, **Temurin Java 21**, **PM2**, configures SQLite + `.env`, creates your Admin user, and starts the panel.

### Installer Shortcuts

| Command | Action |
|---|---|
| `bash install.sh` | Open interactive menu (Install, Update, Create Admin, Uninstall, Cloudflare PM2) |
| `bash install.sh cloudflare` | Install `cloudflared` and manage Cloudflare Tunnel via PM2 (Quick or Token) |
| `bash install.sh status` | Show panel, Node.js, Java, and PM2 status |
| `bash install.sh start` / `stop` / `restart` | Control the background PM2 service |
| `bash install.sh version` | Display installed version |

### Manual / Development Run

```bash
npm install
cp .env.example .env
npx tsx scripts/cli.ts seed
npm run dev
```

---

## Supported Software & Java

**Minecraft Software**

| Software | Upstream Source |
|---|---|
| **Paper** & **Folia** | PaperMC API (SHA-256 verified) |
| **Purpur** | PurpurMC API (MD5 verified) |
| **Vanilla** | Mojang Manifest (SHA-1 verified) |
| **Fabric** | Fabric Meta API |
| **Forge** & **NeoForge** | Official `--installServer` |
| **Spigot** | Official `BuildTools.jar` |

**Java Version Mapping**

| Minecraft Version | Java Runtime |
|---|---|
| `1.20.5 – 1.21+` / `26.x` | Java 21 / 25 / 26 |
| `1.18 – 1.20.4` | Java 17 |
| `1.17.x` | Java 16+ |
| `1.8 – 1.16.5` | Java 8 / 11 |

---

## Railway Deployment

See [RAILWAY.md](RAILWAY.md) for direct Railway deployment, persistent-volume configuration, health checks, and the secure first-admin terminal command. This is a Node.js project, so admin creation uses `npm run admin:create` rather than PHP Artisan.

---

## CLI Commands

```bash
npx tsx scripts/cli.ts migrate                               # Run DB migrations
npx tsx scripts/cli.ts seed                                  # Seed default nests, eggs & node
npx tsx scripts/cli.ts create-admin <email> <user> <pass>    # Create or update admin user
npx tsx scripts/cli.ts java-check                            # List detected Java runtimes
npx tsx scripts/cli.ts java-install <8|11|17|21|25>          # Download Temurin Java runtime
npx tsx scripts/cli.ts db-backup                             # Export SQL database backup
npx tsx scripts/cli.ts db-restore <path-to-sql>              # Restore database backup
```

---

## Project Structure

```text
├── backend/     # Express APIs, WebSocket console, SQLite/MySQL DB, Java & file engine
├── frontend/    # Pterodactyl v1.15.2 React SPA & AdminLTE static assets
├── scripts/     # Admin, DB, and Java CLI utilities
├── docs/        # Additional guides (MIGRATION.md, TESTING.md)
├── server.ts    # Main application entry point
└── install.sh   # Interactive Linux/VPS installer & updater
```

More docs: [Migration Guide](docs/MIGRATION.md) · [Testing Guide](docs/TESTING.md)

---

## License & Credits

- Licensed under the **[MIT License](LICENSE)**.
- Built on **[Pterodactyl Panel v1.15.2](https://pterodactyl.io)** (Copyright © 2015–2021 Dane Everitt and contributors).
- **Node.js + Java Edition** branding: **SOURAJITVFX** (2026).

