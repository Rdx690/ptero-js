import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_DIR = process.cwd();
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

function ensureDir(dir: string): string {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

const storageDir = ensureDir(path.resolve(ROOT_DIR, process.env.STORAGE_DIR || 'storage'));
const serversDir = ensureDir(path.resolve(ROOT_DIR, process.env.SERVERS_DIR || 'storage/servers'));
const backupsDir = ensureDir(path.resolve(ROOT_DIR, process.env.BACKUPS_DIR || 'storage/backups'));
const logsDir = ensureDir(path.resolve(ROOT_DIR, process.env.LOGS_DIR || 'storage/logs'));
const javaRuntimeDir = ensureDir(path.resolve(ROOT_DIR, process.env.JAVA_RUNTIME_DIR || path.join(storageDir, 'runtime/java')));

interface PersistedSecrets {
    appKey: string;
    jwtSecret: string;
}

function loadOrGenerateSecrets(): PersistedSecrets {
    const envAppKey = process.env.APP_KEY;
    const envJwtSecret = process.env.JWT_SECRET;
    const isPlaceholder = (v?: string) => !v || v.startsWith('CHANGE_ME');

    if (!isPlaceholder(envAppKey) && !isPlaceholder(envJwtSecret)) {
        return { appKey: envAppKey!, jwtSecret: envJwtSecret! };
    }

    const secretsFile = path.join(storageDir, '.panel-secrets.json');
    if (fs.existsSync(secretsFile)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(secretsFile, 'utf8')) as PersistedSecrets;
            if (parsed.appKey && parsed.jwtSecret) {
                return {
                    appKey: isPlaceholder(envAppKey) ? parsed.appKey : envAppKey!,
                    jwtSecret: isPlaceholder(envJwtSecret) ? parsed.jwtSecret : envJwtSecret!,
                };
            }
        } catch {
            // Regenerate below if corrupted
        }
    }

    const generated: PersistedSecrets = {
        appKey: isPlaceholder(envAppKey) ? crypto.randomBytes(32).toString('hex') : envAppKey!,
        jwtSecret: isPlaceholder(envJwtSecret) ? crypto.randomBytes(32).toString('hex') : envJwtSecret!,
    };
    fs.writeFileSync(secretsFile, JSON.stringify(generated, null, 2), { mode: 0o600 });
    return generated;
}

const secrets = loadOrGenerateSecrets();

export const config = {
    rootDir: ROOT_DIR,
    appName: process.env.APP_NAME || 'Pterodactyl',
    appVersion: process.env.APP_VERSION || '1.15.2-node',
    appUrl: (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    appKey: secrets.appKey,
    jwtSecret: secrets.jwtSecret,
    sessionCookieName: process.env.SESSION_COOKIE_NAME || 'pterodactyl_session',
    sessionTtlHours: Math.max(1, Number(process.env.SESSION_TTL_HOURS || 72)),
    singleNodeMode: true as const,

    db: {
        connection: (process.env.DB_CONNECTION || (isRailway ? 'sqlite' : 'mysql')).toLowerCase() as 'mysql' | 'sqlite',
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        database: process.env.DB_DATABASE || 'pterodactyl',
        username: process.env.DB_USERNAME || 'pterodactyl',
        password: process.env.DB_PASSWORD || '',
        poolLimit: Number(process.env.DB_POOL_LIMIT || 10),
        allowSqliteDevFallback: process.env.ALLOW_SQLITE_DEV_FALLBACK !== 'false',
        sqlitePath: path.resolve(ROOT_DIR, process.env.SQLITE_PATH || path.join(storageDir, 'database.sqlite')),
    },

    paths: {
        storageDir,
        serversDir,
        backupsDir,
        logsDir,
        javaRuntimeDir,
        frontendPublicDir: path.resolve(ROOT_DIR, 'frontend/public'),
        frontendLocalesDir: path.resolve(ROOT_DIR, 'frontend/locales'),
        viewsDir: path.resolve(ROOT_DIR, 'backend/src/views'),
        migrationsDir: path.resolve(ROOT_DIR, 'backend/migrations'),
        seedersDir: path.resolve(ROOT_DIR, 'backend/seeders'),
    },

    defaultJavaPath: process.env.DEFAULT_JAVA_PATH || '',

    localNode: {
        name: process.env.LOCAL_NODE_NAME || 'Local Node',
        fqdn: process.env.LOCAL_NODE_FQDN || '127.0.0.1',
        memoryMb: Number(process.env.LOCAL_NODE_MEMORY_MB || 8192),
        diskMb: Number(process.env.LOCAL_NODE_DISK_MB || 51200),
    },
};
