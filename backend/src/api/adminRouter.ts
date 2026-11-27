import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import { config } from '../config/index';
import { db } from '../database/connection';
import { discoverJavaRuntimes } from '../minecraft/java';
import { ensureCsrfCookie, requireAdmin, sha256Hex } from '../middleware/auth';
import { processManager } from '../processes/ServerProcessManager';
import { gravatarUrl } from './transformers';

const router = Router();
router.use(requireAdmin);

async function renderAdmin(req: Request, res: Response, template: string, data: Record<string, unknown> = {}) {
    const csrfToken = ensureCsrfCookie(req, res);
    const siteSetting = await db.queryOne<{ value: string }>(
        "SELECT value FROM settings WHERE `key` = 'settings:app:name'"
    );
    const flashError = req.cookies?.['pterodactyl_flash_error'] || '';
    const flashSuccess = req.cookies?.['pterodactyl_flash_success'] || '';
    if (flashError) res.clearCookie('pterodactyl_flash_error');
    if (flashSuccess) res.clearCookie('pterodactyl_flash_success');

    res.render(`admin/${template}`, {
        csrfToken,
        siteName: siteSetting?.value || config.appName,
        appVersion: config.appVersion,
        currentUser: req.user!,
        gravatarUrl: gravatarUrl(req.user!.email),
        flashError,
        flashSuccess,
        ...data,
    });
}

function setFlash(res: Response, type: 'success' | 'error', message: string) {
    res.cookie(`pterodactyl_flash_${type}`, message, { httpOnly: false, path: '/', maxAge: 30_000 });
}

// Overview
router.get('/', async (req: Request, res: Response) => {
    const serversCnt = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM servers');
    const usersCnt = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users');
    const allocCnt = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM allocations');
    await renderAdmin(req, res, 'index', {
        nodeVersion: process.version,
        dbDriver: db.getDriver(),
        stats: {
            servers: serversCnt?.cnt || 0,
            users: usersCnt?.cnt || 0,
            allocations: allocCnt?.cnt || 0,
        },
    });
});

// Single-Node Mode enforcement: block multi-node creation
router.all('/nodes/new', (_req: Request, res: Response) => {
    res.status(403).send(
        'Multi-node creation is disabled in Single-Node Mode. Manage local allocations at /admin/allocations.'
    );
});
router.get('/nodes*', (_req: Request, res: Response) => {
    res.redirect('/admin/allocations');
});

// Settings
router.get('/settings', async (req: Request, res: Response) => {
    const rows = await db.query<{ key: string; value: string }>('SELECT `key`, value FROM settings');
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    await renderAdmin(req, res, 'settings', { settings });
});

router.post('/settings', async (req: Request, res: Response) => {
    const updates: Record<string, string> = {
        'settings:app:name': String(req.body?.['app:name'] || config.appName).trim(),
        'settings:pterodactyl:auth:2fa_required': String(req.body?.['pterodactyl:auth:2fa_required'] || '0'),
    };
    for (const [k, v] of Object.entries(updates)) {
        const exists = await db.queryOne('SELECT id FROM settings WHERE `key` = ?', [k]);
        if (exists) {
            await db.execute('UPDATE settings SET value = ? WHERE `key` = ?', [v, k]);
        } else {
            await db.execute('INSERT INTO settings (`key`, value) VALUES (?, ?)', [k, v]);
        }
    }
    setFlash(res, 'success', 'Panel settings have been updated.');
    res.redirect('/admin/settings');
});

// Application API
router.get('/api', async (req: Request, res: Response) => {
    const keys = await db.query<any>('SELECT * FROM api_keys WHERE key_type = 2 ORDER BY id DESC');
    const newToken = req.cookies?.['pterodactyl_new_apikey'] || '';
    if (newToken) res.clearCookie('pterodactyl_new_apikey');
    await renderAdmin(req, res, 'api', { keys, newToken });
});

router.post('/api/new', async (req: Request, res: Response) => {
    const memo = String(req.body?.memo || '').trim();
    const identifier = crypto.randomBytes(8).toString('hex');
    const secret = crypto.randomBytes(24).toString('hex');
    await db.execute(
        `INSERT INTO api_keys (
            user_id, key_type, identifier, token, memo,
            r_servers, r_nodes, r_allocations, r_users, r_locations, r_nests, r_eggs, r_database_hosts, r_server_databases
        ) VALUES (?, 2, ?, ?, ?, 2, 2, 2, 2, 2, 2, 2, 2, 2)`,
        [req.user!.id, identifier, sha256Hex(secret), memo]
    );
    res.cookie('pterodactyl_new_apikey', `ptla_${identifier}${secret}`, { httpOnly: false, path: '/', maxAge: 30_000 });
    res.redirect('/admin/api');
});

router.post('/api/delete/:id', async (req: Request, res: Response) => {
    await db.execute('DELETE FROM api_keys WHERE id = ? AND key_type = 2', [req.params.id]);
    setFlash(res, 'success', 'API key deleted.');
    res.redirect('/admin/api');
});

// Databases
router.get('/databases', async (req: Request, res: Response) => {
    const hosts = await db.query<any>(
        `SELECT dh.*, (SELECT COUNT(*) FROM databases d WHERE d.database_host_id = dh.id) AS db_count
         FROM database_hosts dh ORDER BY dh.id ASC`
    );
    await renderAdmin(req, res, 'databases', { hosts });
});

router.post('/databases', async (req: Request, res: Response) => {
    const { name, host, port, username, password } = req.body || {};
    await db.execute(
        'INSERT INTO database_hosts (name, host, port, username, password, node_id) VALUES (?, ?, ?, ?, ?, 1)',
        [String(name), String(host), Number(port || 3306), String(username), String(password)]
    );
    setFlash(res, 'success', 'Database host created.');
    res.redirect('/admin/databases');
});

router.post('/databases/delete/:id', async (req: Request, res: Response) => {
    await db.execute('DELETE FROM database_hosts WHERE id = ?', [req.params.id]);
    setFlash(res, 'success', 'Database host removed.');
    res.redirect('/admin/databases');
});

// Locations
router.get('/locations', async (req: Request, res: Response) => {
    const locations = await db.query<any>(
        `SELECT l.*, (SELECT COUNT(*) FROM servers s JOIN nodes n ON n.id = s.node_id WHERE n.location_id = l.id) AS server_count
         FROM locations l ORDER BY l.id ASC`
    );
    await renderAdmin(req, res, 'locations', { locations });
});

router.post('/locations', async (req: Request, res: Response) => {
    const short = String(req.body?.short || '').trim();
    const long = String(req.body?.long || '').trim();
    if (short && long) {
        await db.execute('INSERT INTO locations (short, `long`) VALUES (?, ?)', [short, long]);
        setFlash(res, 'success', 'Location created.');
    }
    res.redirect('/admin/locations');
});

// Single-Node Allocations
router.get('/allocations', async (req: Request, res: Response) => {
    const node = await db.queryOne<any>('SELECT * FROM nodes WHERE id = 1');
    const allocations = await db.query<any>(
        `SELECT a.*, s.name AS server_name
         FROM allocations a
         LEFT JOIN servers s ON s.id = a.server_id
         WHERE a.node_id = 1
         ORDER BY a.port ASC`
    );
    await renderAdmin(req, res, 'allocations', { node, allocations });
});

router.post('/allocations', async (req: Request, res: Response) => {
    const ip = String(req.body?.ip || '0.0.0.0').trim();
    const ipAlias = req.body?.ip_alias ? String(req.body.ip_alias).trim() : null;
    const portsRaw = String(req.body?.ports || '').trim();

    const ports: number[] = [];
    for (const part of portsRaw.split(',')) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const [s, e] = trimmed.split('-').map(Number);
            if (Number.isInteger(s) && Number.isInteger(e) && e >= s && e - s <= 100) {
                for (let p = s; p <= e; p++) ports.push(p);
            }
        } else {
            const p = Number(trimmed);
            if (Number.isInteger(p) && p >= 1024 && p <= 65535) ports.push(p);
        }
    }

    for (const port of ports) {
        const exists = await db.queryOne('SELECT id FROM allocations WHERE node_id = 1 AND ip = ? AND port = ?', [ip, port]);
        if (!exists) {
            await db.execute('INSERT INTO allocations (node_id, ip, ip_alias, port) VALUES (1, ?, ?, ?)', [
                ip,
                ipAlias,
                port,
            ]);
        }
    }
    setFlash(res, 'success', `Added ${ports.length} allocation(s) on ${ip}.`);
    res.redirect('/admin/allocations');
});

router.post('/allocations/delete/:id', async (req: Request, res: Response) => {
    await db.execute('DELETE FROM allocations WHERE id = ? AND server_id IS NULL', [req.params.id]);
    setFlash(res, 'success', 'Allocation removed.');
    res.redirect('/admin/allocations');
});

router.post('/allocations/delete-mass', async (req: Request, res: Response) => {
    const rawIds = req.body?.ids;
    const idList = (Array.isArray(rawIds) ? rawIds : typeof rawIds === 'string' ? [rawIds] : [])
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0);

    if (idList.length === 0) {
        setFlash(res, 'error', 'No unused allocations selected.');
        res.redirect('/admin/allocations');
        return;
    }

    const placeholders = idList.map(() => '?').join(', ');
    const result = await db.execute(
        `DELETE FROM allocations WHERE id IN (${placeholders}) AND server_id IS NULL`,
        idList
    );
    setFlash(res, 'success', `Removed ${result.affectedRows} unused allocation(s).`);
    res.redirect('/admin/allocations');
});

// Users
router.get('/users', async (req: Request, res: Response) => {
    const query = String(req.query.query || '').trim();
    let rows = await db.query<any>(
        `SELECT u.*, (SELECT COUNT(*) FROM servers s WHERE s.owner_id = u.id) AS servers_count
         FROM users u ORDER BY u.id ASC`
    );
    if (query) {
        const q = query.toLowerCase();
        rows = rows.filter(
            (u) =>
                u.email.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q) ||
                u.name_first.toLowerCase().includes(q) ||
                u.name_last.toLowerCase().includes(q)
        );
    }
    const users = rows.map((u) => ({ ...u, avatar: gravatarUrl(u.email) }));
    await renderAdmin(req, res, 'users', { users, query });
});

router.get('/users/new', async (req: Request, res: Response) => {
    await renderAdmin(req, res, 'users-new');
});

router.post('/users/new', async (req: Request, res: Response) => {
    const { email, username, name_first, name_last, password, root_admin } = req.body || {};
    if (!email || !username || !name_first || !name_last || !password) {
        setFlash(res, 'error', 'All user fields are required.');
        res.redirect('/admin/users/new');
        return;
    }
    const existing = await db.queryOne('SELECT id FROM users WHERE email = ? OR username = ?', [
        String(email).trim(),
        String(username).trim().toLowerCase(),
    ]);
    if (existing) {
        setFlash(res, 'error', 'A user with that email or username already exists.');
        res.redirect('/admin/users/new');
        return;
    }
    const hash = await bcrypt.hash(String(password), 10);
    const result = await db.execute(
        `INSERT INTO users (uuid, username, email, name_first, name_last, password, language, root_admin, gravatar)
         VALUES (?, ?, ?, ?, ?, ?, 'en', ?, 1)`,
        [
            crypto.randomUUID(),
            String(username).trim().toLowerCase(),
            String(email).trim(),
            String(name_first).trim(),
            String(name_last).trim(),
            hash,
            root_admin === '1' ? 1 : 0,
        ]
    );
    setFlash(res, 'success', 'User account created.');
    res.redirect(`/admin/users/view/${result.insertId}`);
});

router.get('/users/view/:id', async (req: Request, res: Response) => {
    const user = await db.queryOne<any>('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
        res.redirect('/admin/users');
        return;
    }
    const owned = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM servers WHERE owner_id = ?', [user.id]);
    await renderAdmin(req, res, 'users-view', { user, ownedServers: owned?.cnt || 0 });
});

router.post('/users/view/:id', async (req: Request, res: Response) => {
    const { email, username, name_first, name_last, password, root_admin } = req.body || {};
    await db.execute('UPDATE users SET email = ?, username = ?, name_first = ?, name_last = ?, root_admin = ? WHERE id = ?', [
        String(email).trim(),
        String(username).trim().toLowerCase(),
        String(name_first).trim(),
        String(name_last).trim(),
        root_admin === '1' ? 1 : 0,
        req.params.id,
    ]);
    if (password && String(password).length >= 8) {
        const hash = await bcrypt.hash(String(password), 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hash, req.params.id]);
    }
    setFlash(res, 'success', 'User account updated.');
    res.redirect(`/admin/users/view/${req.params.id}`);
});

router.post('/users/delete/:id', async (req: Request, res: Response) => {
    if (Number(req.params.id) === req.user!.id) {
        setFlash(res, 'error', 'You cannot delete your own account.');
        res.redirect(`/admin/users/view/${req.params.id}`);
        return;
    }
    const owned = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM servers WHERE owner_id = ?', [
        req.params.id,
    ]);
    if ((owned?.cnt || 0) > 0) {
        setFlash(res, 'error', 'Cannot delete a user who owns active servers.');
        res.redirect(`/admin/users/view/${req.params.id}`);
        return;
    }
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    setFlash(res, 'success', 'User deleted.');
    res.redirect('/admin/users');
});

// Servers
router.get('/servers', async (req: Request, res: Response) => {
    const query = String(req.query.query || '').trim();
    let servers = await db.query<any>(
        `SELECT s.*, u.username AS owner_username, e.name AS egg_name, a.ip, a.port
         FROM servers s
         JOIN users u ON u.id = s.owner_id
         JOIN eggs e ON e.id = s.egg_id
         LEFT JOIN allocations a ON a.id = s.allocation_id
         ORDER BY s.id ASC`
    );
    if (query) {
        const q = query.toLowerCase();
        servers = servers.filter(
            (s) => s.name.toLowerCase().includes(q) || s.uuid.toLowerCase().includes(q) || s.owner_username.toLowerCase().includes(q)
        );
    }
    await renderAdmin(req, res, 'servers', { servers, query });
});

router.get('/servers/new', async (req: Request, res: Response) => {
    const users = await db.query<any>('SELECT id, username, email FROM users ORDER BY id ASC');
    const node = await db.queryOne<any>('SELECT * FROM nodes WHERE id = 1');
    const freeAllocations = await db.query<any>(
        'SELECT * FROM allocations WHERE node_id = 1 AND server_id IS NULL ORDER BY port ASC'
    );
    const nests = await db.query<any>('SELECT * FROM nests ORDER BY id ASC');
    const eggs = await db.query<any>('SELECT * FROM eggs ORDER BY id ASC');
    await renderAdmin(req, res, 'servers-new', { users, node, freeAllocations, nests, eggs });
});

router.post('/servers/new', async (req: Request, res: Response) => {
    const {
        name,
        owner_id,
        description,
        allocation_id,
        memory,
        disk,
        cpu,
        database_limit,
        allocation_limit,
        backup_limit,
        nest_id,
        egg_id,
        minecraft_version,
        image,
        startup,
        skip_scripts,
        start_on_completion,
    } = req.body || {};

    const alloc = await db.queryOne<any>('SELECT * FROM allocations WHERE id = ? AND server_id IS NULL', [
        Number(allocation_id),
    ]);
    if (!alloc) {
        setFlash(res, 'error', 'Selected allocation is invalid or already assigned.');
        res.redirect('/admin/servers/new');
        return;
    }

    const egg = await db.queryOne<any>('SELECT * FROM eggs WHERE id = ?', [Number(egg_id)]);
    if (!egg) {
        setFlash(res, 'error', 'Selected server software egg was not found.');
        res.redirect('/admin/servers/new');
        return;
    }

    const parseLimit = (val: unknown, defaultVal: number): number => {
        if (val === undefined || val === null || String(val).trim() === '') return defaultVal;
        const n = Number(val);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultVal;
    };

    const uuid = crypto.randomUUID();
    const uuidShort = uuid.split('-')[0];
    const skipScripts = skip_scripts === '1' ? 1 : 0;

    const resIns = await db.execute(
        `INSERT INTO servers (
            uuid, uuidShort, node_id, name, description, status, skip_scripts, owner_id,
            memory, swap, disk, io, cpu, oom_disabled, allocation_id, nest_id, egg_id,
            startup, image, allocation_limit, database_limit, backup_limit, installed_at
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 0, ?, 500, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            uuid,
            uuidShort,
            String(name).trim(),
            String(description || ''),
            skipScripts ? null : 'installing',
            skipScripts,
            Number(owner_id),
            parseLimit(memory, 2048),
            parseLimit(disk, 10240),
            parseLimit(cpu, 0),
            alloc.id,
            Number(nest_id || egg.nest_id),
            egg.id,
            String(startup || egg.startup),
            String(image || 'java:auto'),
            parseLimit(allocation_limit, 1),
            parseLimit(database_limit, 0),
            parseLimit(backup_limit, 5),
            skipScripts ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
        ]
    );
    const serverId = resIns.insertId;
    await db.execute('UPDATE allocations SET server_id = ? WHERE id = ?', [serverId, alloc.id]);

    // Populate server_variables from egg_variables
    const eggVars = await db.query<any>('SELECT * FROM egg_variables WHERE egg_id = ?', [egg.id]);
    for (const ev of eggVars) {
        let val = ev.default_value;
        if (ev.env_variable === 'MINECRAFT_VERSION' && minecraft_version) {
            val = String(minecraft_version).trim();
        }
        await db.execute('INSERT INTO server_variables (server_id, variable_id, variable_value) VALUES (?, ?, ?)', [
            serverId,
            ev.id,
            val,
        ]);
    }

    fs.mkdirSync(path.join(config.paths.serversDir, uuid), { recursive: true });

    if (!skipScripts) {
        processManager
            .installServer(serverId)
            .then(async () => {
                if (start_on_completion === '1') {
                    await processManager.startServer(serverId).catch(() => {});
                }
            })
            .catch(() => {});
    }

    setFlash(res, 'success', `Server "${name}" created successfully.`);
    res.redirect(`/admin/servers/view/${serverId}`);
});

router.get('/servers/view/:id', async (req: Request, res: Response) => {
    const server = await db.queryOne<any>(
        `SELECT s.*, e.name AS egg_name, a.ip, a.port
         FROM servers s
         JOIN eggs e ON e.id = s.egg_id
         LEFT JOIN allocations a ON a.id = s.allocation_id
         WHERE s.id = ?`,
        [req.params.id]
    );
    if (!server) {
        res.redirect('/admin/servers');
        return;
    }
    const processState = processManager.getState(server.uuid);
    await renderAdmin(req, res, 'servers-view', { server, processState });
});

router.post('/servers/view/:id/update', async (req: Request, res: Response) => {
    const { name, description, memory, disk, cpu, database_limit, allocation_limit, backup_limit, startup, image } =
        req.body || {};
    const parseLimit = (val: unknown, defaultVal: number): number => {
        if (val === undefined || val === null || String(val).trim() === '') return defaultVal;
        const n = Number(val);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : defaultVal;
    };
    await db.execute(
        `UPDATE servers SET name = ?, description = ?, memory = ?, disk = ?, cpu = ?, database_limit = ?, allocation_limit = ?, backup_limit = ?, startup = ?, image = ? WHERE id = ?`,
        [
            String(name).trim(),
            String(description || ''),
            parseLimit(memory, 2048),
            parseLimit(disk, 10240),
            parseLimit(cpu, 0),
            parseLimit(database_limit, 0),
            parseLimit(allocation_limit, 1),
            parseLimit(backup_limit, 5),
            String(startup),
            String(image || 'java:auto'),
            req.params.id,
        ]
    );
    setFlash(res, 'success', 'Server details updated.');
    res.redirect(`/admin/servers/view/${req.params.id}`);
});

router.post('/servers/view/:id/reinstall', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    processManager.installServer(id).catch(() => {});
    setFlash(res, 'success', 'Server software installation started in background.');
    res.redirect(`/admin/servers/view/${id}`);
});

router.post('/servers/view/:id/suspension', async (req: Request, res: Response) => {
    const server = await db.queryOne<any>('SELECT * FROM servers WHERE id = ?', [req.params.id]);
    if (server) {
        if (server.status === 'suspended') {
            await db.execute('UPDATE servers SET status = NULL WHERE id = ?', [server.id]);
            setFlash(res, 'success', 'Server unsuspended.');
        } else {
            await processManager.stopServer(server.id, true);
            await db.execute("UPDATE servers SET status = 'suspended' WHERE id = ?", [server.id]);
            setFlash(res, 'success', 'Server suspended.');
        }
    }
    res.redirect(`/admin/servers/view/${req.params.id}`);
});

router.post('/servers/view/:id/delete', async (req: Request, res: Response) => {
    const server = await db.queryOne<any>('SELECT * FROM servers WHERE id = ?', [req.params.id]);
    if (server) {
        await processManager.stopServer(server.id, true);
        await db.execute('UPDATE allocations SET server_id = NULL WHERE server_id = ?', [server.id]);
        await db.execute('DELETE FROM servers WHERE id = ?', [server.id]);
        fs.rmSync(path.join(config.paths.serversDir, server.uuid), { recursive: true, force: true });
        fs.rmSync(path.join(config.paths.backupsDir, server.uuid), { recursive: true, force: true });
        setFlash(res, 'success', `Server "${server.name}" deleted.`);
    }
    res.redirect('/admin/servers');
});

// Nests
router.get('/nests', async (req: Request, res: Response) => {
    const eggs = await db.query<any>(
        `SELECT e.*, n.name AS nest_name FROM eggs e JOIN nests n ON n.id = e.nest_id ORDER BY n.id ASC, e.id ASC`
    );
    await renderAdmin(req, res, 'nests', { eggs });
});

export default router;
