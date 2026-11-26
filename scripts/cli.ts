import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../backend/src/database/connection';
import { backupDatabase, restoreDatabase } from '../backend/src/database/backup';
import { runMigrations } from '../backend/src/database/migrate';
import { runSeeders } from '../backend/src/database/seed';
import { discoverJavaRuntimes, installTemurinJava } from '../backend/src/minecraft/java';

async function main() {
    const [, , cmd, ...args] = process.argv;

    try {
        switch (cmd) {
            case 'migrate': {
                const ran = await runMigrations();
                console.log('Migrations complete:', ran.length ? ran.join(', ') : 'up to date');
                break;
            }
            case 'seed': {
                await runMigrations();
                await runSeeders();
                console.log('Database seeding complete.');
                break;
            }
            case 'db-backup': {
                const dest = await backupDatabase(args[0]);
                console.log('Database backup created:', dest);
                break;
            }
            case 'db-restore': {
                if (!args[0]) throw new Error('Usage: cli.ts db-restore <backup-file>');
                await restoreDatabase(args[0]);
                console.log('Database restored from:', args[0]);
                break;
            }
            case 'java-check': {
                const runtimes = await discoverJavaRuntimes();
                console.log(JSON.stringify(runtimes, null, 2));
                break;
            }
            case 'java-install': {
                const ver = Number(args[0] || 21) as 8 | 11 | 17 | 21 | 25;
                if (![8, 11, 17, 21, 25].includes(ver)) throw new Error('Supported Java versions: 8, 11, 17, 21, 25');
                const rt = await installTemurinJava(ver, (m) => console.log(m));
                console.log('Installed:', rt);
                break;
            }
            case 'create-admin': {
                const email = (args[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
                const username = (args[1] || process.env.ADMIN_USERNAME || '').trim().toLowerCase();
                const password = args[2] || process.env.ADMIN_PASSWORD || '';
                if (!email || !username || !password) {
                    throw new Error(
                        'Usage: npm run admin:create -- <email> <username> <password> OR set ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD.'
                    );
                }
                if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
                    throw new Error('Please provide a valid admin email address.');
                }
                if (username.length < 3 || username.length > 32 || !/^[a-z0-9_.-]+$/.test(username)) {
                    throw new Error('Username must be 3-32 characters and use only lowercase letters, numbers, dots, underscores or hyphens.');
                }
                if (password.length < 12) {
                    throw new Error('Admin password must be at least 12 characters long.');
                }
                await runMigrations();
                const hash = await bcrypt.hash(password, 12);
                const matches = await db.query<{ id: number; email: string; username: string }>(
                    'SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
                    [email, username]
                );
                const sameAccount = matches.find(
                    (u) => u.email.toLowerCase() === email && u.username.toLowerCase() === username
                );
                if (matches.length > 0 && !sameAccount) {
                    throw new Error('Email or username already belongs to a different account. No user was changed.');
                }
                if (sameAccount) {
                    await db.execute('UPDATE users SET password = ?, root_admin = 1 WHERE id = ?', [hash, sameAccount.id]);
                    console.log(`Updated admin user ${username} (${email})`);
                } else {
                    await db.execute(
                        `INSERT INTO users (uuid, username, email, name_first, name_last, password, language, root_admin, gravatar)
                         VALUES (?, ?, ?, 'System', 'Administrator', ?, 'en', 1, 1)`,
                        [crypto.randomUUID(), username, email, hash]
                    );
                    console.log(`Created admin user ${username} (${email})`);
                }
                break;
            }
            default:
                console.error(
                    'Usage: tsx scripts/cli.ts <migrate|seed|db-backup|db-restore|java-check|java-install|create-admin>'
                );
                process.exitCode = 1;
        }
    } finally {
        await db.close();
    }
}

main().catch((err) => {
    console.error('CLI Error:', err);
    process.exit(1);
});
