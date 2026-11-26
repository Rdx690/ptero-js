# Railway deployment — SOURAJITVFX

This repository is a **Node.js + TypeScript** panel. It is not a Laravel/PHP project, so there is no `php artisan` command.

## Deploy the panel

1. In Railway, create a project and add a service from GitHub: `Rdx690/ptero-js`, branch `main`.
2. In the service settings, attach a **Volume** mounted at `/app/storage`. Without this volume, SQLite data, uploaded server files, backups, logs and generated secrets can be lost on redeploy.
3. Set these service variables:

| Variable | Value |
|---|---|
| `RAILPACK_NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `DB_CONNECTION` | `sqlite` |
| `SQLITE_PATH` | `/app/storage/database.sqlite` |
| `STORAGE_DIR` | `/app/storage` |
| `SERVERS_DIR` | `/app/storage/servers` |
| `BACKUPS_DIR` | `/app/storage/backups` |
| `LOGS_DIR` | `/app/storage/logs` |
| `JAVA_RUNTIME_DIR` | `/app/storage/runtime/java` |

4. Generate a Railway public domain and set `APP_URL` to that HTTPS URL.
5. Deploy. Railway uses `railway.json`, runs `npm run build`, starts `npm start`, and checks `/healthz`.

The application runs migrations and seeders on startup. Do not run the interactive VPS installer on Railway.

## Create the first admin from Railway's service terminal

Set these temporary service variables in Railway before opening the service terminal:

- `ADMIN_EMAIL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (at least 12 characters)

Then run **only**:

```bash
npm run admin:create
```

The command creates the admin, or upgrades the matching existing account. It refuses to modify an account if the email and username point to different users. After successful creation, remove `ADMIN_PASSWORD` (and the other temporary admin variables) from Railway Variables, then redeploy/restart the service.

You can also pass credentials directly in a private terminal session:

```bash
npm run admin:create -- admin@example.com sourajit YOUR_STRONG_PASSWORD
```

Avoid this form on shared terminals because shell history may retain the password.

## Important Railway limitations

Railway can host the **web panel** and its Node.js process. It is not a general-purpose VPS: this project starts Minecraft Java processes as child processes, and Railway does not provide a user-managed Docker daemon/Wings host. Public game connectivity, especially UDP-based services and arbitrary allocations, is not equivalent to a dedicated Pterodactyl node. Use a real VPS with Docker/Wings for production game-server hosting. Railway storage must be mounted as above for durable panel data.
