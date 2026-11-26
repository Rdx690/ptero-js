import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import http from 'node:http';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import adminRouter from './backend/src/api/adminRouter';
import applicationRouter from './backend/src/api/applicationRouter';
import authRouter from './backend/src/api/authRouter';
import clientRouter from './backend/src/api/clientRouter';
import daemonRouter from './backend/src/api/daemonRouter';
import spaRouter from './backend/src/api/spaRouter';
import { config } from './backend/src/config/index';
import { db } from './backend/src/database/connection';
import { runMigrations } from './backend/src/database/migrate';
import { runSeeders } from './backend/src/database/seed';
import { attachSessionUser, csrfProtection } from './backend/src/middleware/auth';
import { processManager } from './backend/src/processes/ServerProcessManager';
import { startScheduler, stopScheduler } from './backend/src/scheduler/schedulerEngine';
import { logger } from './backend/src/utils/logger';
import { attachWebSocketServer } from './backend/src/websocket/wsServer';

async function bootstrapAdminFromEnvironment(): Promise<void> {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';

    if (!email && !username && !password) return;
    if (!email || !username || !password) {
        throw new Error('Set ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD together to bootstrap the initial admin.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL is not a valid email address.');
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) throw new Error('ADMIN_USERNAME must be 3-32 lowercase letters, numbers, dots, underscores or hyphens.');
    if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');

    const matches = await db.query<{ id: number; email: string; username: string }>(
        'SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
        [email, username]
    );
    const sameAccount = matches.find(
        (user) => user.email.toLowerCase() === email && user.username.toLowerCase() === username
    );

    if (matches.length > 0 && !sameAccount) {
        throw new Error('Admin bootstrap stopped: ADMIN_EMAIL or ADMIN_USERNAME is already used by a different account.');
    }

    if (sameAccount) {
        await db.execute('UPDATE users SET root_admin = 1 WHERE id = ?', [sameAccount.id]);
        logger.info('Environment admin already exists; root admin access confirmed.', { username });
        return;
    }

    const hash = await bcrypt.hash(password, 12);
    await db.execute(
        `INSERT INTO users (uuid, username, email, name_first, name_last, password, language, root_admin, gravatar)
         VALUES (?, ?, ?, 'System', 'Administrator', ?, 'en', 1, 1)`,
        [crypto.randomUUID(), username, email, hash]
    );
    logger.info('Initial root admin created from Railway environment variables.', { username });
}

async function bootstrap() {
    await db.init();
    await runMigrations();
    await runSeeders();
    await bootstrapAdminFromEnvironment();

    const app = express();
    app.set('trust proxy', 1);
    app.set('view engine', 'ejs');
    app.set('views', config.paths.viewsDir);

    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
            frameguard: false,
        })
    );

    app.use(cookieParser());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.text({ type: 'text/plain', limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Serve original Pterodactyl static assets; revalidate JS/CSS via ETag while caching fonts/images long-term
    app.use(
        express.static(config.paths.frontendPublicDir, {
            etag: true,
            lastModified: true,
            index: false,
            setHeaders: (res, filePath) => {
                if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
                } else if (/\.(woff2?|ttf|eot|svg|png|jpe?g|ico|gif)$/i.test(filePath)) {
                    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
                }
            },
        })
    );

    app.get('/healthz', async (_req, res) => {
        try {
            await db.query('SELECT 1');
            res.json({ ok: true, mode: 'single-node', db: db.getDriver(), version: config.appVersion });
        } catch (err) {
            res.status(500).json({ ok: false, error: (err as Error).message });
        }
    });

    app.use(attachSessionUser);
    app.use(csrfProtection);

    app.use(authRouter);
    app.use('/api/client', clientRouter);
    app.use(applicationRouter);
    app.use(daemonRouter);
    app.use('/admin', adminRouter);
    app.use(spaRouter);

    const httpServer = http.createServer(app);
    httpServer.requestTimeout = 0;
    httpServer.headersTimeout = 60000;
    attachWebSocketServer(httpServer);

    processManager.startMonitor();
    startScheduler();

    httpServer.listen(config.port, '0.0.0.0', () => {
        logger.info(`Pterodactyl Node.js Panel listening on http://0.0.0.0:${config.port}`, {
            db: db.getDriver(),
            singleNodeMode: config.singleNodeMode,
        });
    });

    const shutdown = async () => {
        logger.info('Graceful shutdown initiated...');
        stopScheduler();
        processManager.stopMonitor();
        await processManager.stopAllServers();
        httpServer.close();
        await db.close();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
    logger.error('Fatal startup error', { err: (err as Error).stack || String(err) });
    process.exit(1);
});
