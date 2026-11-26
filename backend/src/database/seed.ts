import crypto from 'node:crypto';
import { config } from '../config/index';
import { db } from './connection';

export interface EggSeedDefinition {
    name: string;
    softwareType: string;
    description: string;
    startup: string;
    dockerImages: Record<string, string>;
    configFiles: Record<string, unknown>;
    configStartup: Record<string, unknown>;
    configStop: string;
    variables: Array<{
        name: string;
        description: string;
        env_variable: string;
        default_value: string;
        user_viewable: boolean;
        user_editable: boolean;
        rules: string;
    }>;
}

const MINECRAFT_EGGS: EggSeedDefinition[] = [
    {
        name: 'Paper',
        softwareType: 'paper',
        description: 'High performance Spigot fork that aims to fix gameplay and mechanics inconsistencies.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=false -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Java 11': 'java:11',
            'Java 8': 'java:8',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: {
                    'server-ip': '0.0.0.0',
                    'server-port': '{{server.build.default.port}}',
                    'query.port': '{{server.build.default.port}}',
                },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'The version of Minecraft to download. Leave at latest for the newest release.',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Server Jar File',
                description: 'The name of the server jarfile to run the server with.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'server.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|regex:/^([\\w\\d._-]+)(\\.jar)$/',
            },
            {
                name: 'Build Number',
                description: 'The Paper build number to download (or latest).',
                env_variable: 'BUILD_NUMBER',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
        ],
    },
    {
        name: 'Purpur',
        softwareType: 'purpur',
        description: 'Purpur is a drop-in replacement for Paper servers designed for configurability and new gameplay features.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=false -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Java 8': 'java:8',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: { 'server-ip': '0.0.0.0', 'server-port': '{{server.build.default.port}}' },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'The version of Minecraft to download (e.g. 1.21.4 or latest).',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Server Jar File',
                description: 'The name of the server jarfile to run.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'server.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|regex:/^([\\w\\d._-]+)(\\.jar)$/',
            },
            {
                name: 'Build Number',
                description: 'The Purpur build number (or latest).',
                env_variable: 'BUILD_NUMBER',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
        ],
    },
    {
        name: 'Vanilla Minecraft',
        softwareType: 'vanilla',
        description: 'Official Minecraft: Java Edition server directly from Mojang.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Java 8': 'java:8',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: { 'server-ip': '0.0.0.0', 'server-port': '{{server.build.default.port}}' },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'Official Minecraft version (e.g. 1.21.4 or latest).',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Server Jar File',
                description: 'The name of the server jarfile.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'server.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|regex:/^([\\w\\d._-]+)(\\.jar)$/',
            },
        ],
    },
    {
        name: 'Fabric',
        softwareType: 'fabric',
        description: 'Lightweight, experimental modding toolchain for Minecraft.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Java 8': 'java:8',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: { 'server-ip': '0.0.0.0', 'server-port': '{{server.build.default.port}}' },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'The Minecraft version for Fabric.',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Fabric Loader Version',
                description: 'Fabric Loader version (or latest).',
                env_variable: 'LOADER_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:32',
            },
            {
                name: 'Server Jar File',
                description: 'The name of the Fabric server launcher jar.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'fabric-server-launch.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|regex:/^([\\w\\d._-]+)(\\.jar)$/',
            },
        ],
    },
    {
        name: 'Forge Minecraft',
        softwareType: 'forge',
        description: 'Minecraft Forge server modding platform.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Java 8': 'java:8',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: { 'server-ip': '0.0.0.0', 'server-port': '{{server.build.default.port}}' },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'The Minecraft version for Forge (e.g. 1.20.1 or latest).',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Forge Version',
                description: 'Specific Forge version or recommended/latest.',
                env_variable: 'FORGE_VERSION',
                default_value: 'recommended',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:32',
            },
            {
                name: 'Server Jar File',
                description: 'Server launcher jar or @libraries argfile.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'server.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|string|max:128',
            },
        ],
    },
    {
        name: 'NeoForge',
        softwareType: 'neoforge',
        description: 'Modern community fork of Minecraft Forge for Minecraft 1.20.2+.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: { 'server-ip': '0.0.0.0', 'server-port': '{{server.build.default.port}}' },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'Target Minecraft version (1.20.2+ or latest).',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'NeoForge Version',
                description: 'NeoForge version or latest.',
                env_variable: 'NEOFORGE_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:32',
            },
            {
                name: 'Server Jar File',
                description: 'Server launcher jar or @libraries argfile.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'server.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|string|max:128',
            },
        ],
    },
    {
        name: 'Spigot',
        softwareType: 'spigot',
        description: 'Spigot Minecraft server built via official SpigotMC BuildTools.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Java 8': 'java:8',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: { 'server-ip': '0.0.0.0', 'server-port': '{{server.build.default.port}}' },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'Minecraft version to compile via BuildTools (e.g. 1.21.4 or latest).',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Server Jar File',
                description: 'The compiled Spigot server jarfile.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'spigot.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|regex:/^([\\w\\d._-]+)(\\.jar)$/',
            },
        ],
    },
    {
        name: 'Folia',
        softwareType: 'folia',
        description: 'Multithreaded PaperMC fork adding regionised multithreading to dedicated servers.',
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=false -jar {{SERVER_JARFILE}} nogui',
        dockerImages: {
            'Java 26': 'java:26',
            'Java 25': 'java:25',
            'Java 21': 'java:21',
            'Java 17': 'java:17',
            'Auto Detect': 'java:auto',
        },
        configFiles: {
            'server.properties': {
                parser: 'properties',
                find: { 'server-ip': '0.0.0.0', 'server-port': '{{server.build.default.port}}' },
            },
        },
        configStartup: { done: ')! For help, type ' },
        configStop: 'stop',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'Folia compatible Minecraft version (1.19.4+ or latest).',
                env_variable: 'MINECRAFT_VERSION',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Server Jar File',
                description: 'The name of the Folia server jarfile.',
                env_variable: 'SERVER_JARFILE',
                default_value: 'server.jar',
                user_viewable: true,
                user_editable: true,
                rules: 'required|regex:/^([\\w\\d._-]+)(\\.jar)$/',
            },
            {
                name: 'Build Number',
                description: 'Folia build number (or latest).',
                env_variable: 'BUILD_NUMBER',
                default_value: 'latest',
                user_viewable: true,
                user_editable: true,
                rules: 'nullable|string|max:20',
            },
        ],
    },
];

export async function runSeeders(): Promise<void> {
    await db.init();

    // 1. Ensure default location exists
    let location = await db.queryOne<{ id: number }>('SELECT id FROM locations WHERE id = 1');
    if (!location) {
        await db.execute('INSERT INTO locations (short, `long`) VALUES (?, ?)', [
            'local',
            'Single-Node Local Environment',
        ]);
        location = await db.queryOne<{ id: number }>('SELECT id FROM locations ORDER BY id ASC LIMIT 1');
    }

    // 2. Ensure single local node (id = 1) exists
    const node = await db.queryOne<{ id: number }>('SELECT id FROM nodes WHERE id = 1');
    if (!node && location) {
        await db.execute(
            `INSERT INTO nodes (
                uuid, public, name, description, location_id, fqdn, scheme, behind_proxy,
                maintenance_mode, memory, memory_overallocate, disk, disk_overallocate,
                upload_size, daemon_token_id, daemon_token, daemonListen, daemonSFTP, daemonBase
            ) VALUES (?, 1, ?, ?, ?, ?, 'http', 0, 0, ?, 0, ?, 0, 100, ?, ?, ?, 2022, ?)`,
            [
                crypto.randomUUID(),
                config.localNode.name,
                'Built-in single-node Java Minecraft engine',
                location.id,
                config.localNode.fqdn,
                config.localNode.memoryMb,
                config.localNode.diskMb,
                crypto.randomBytes(8).toString('hex'),
                crypto.randomBytes(32).toString('hex'),
                config.port,
                config.paths.serversDir,
            ]
        );
    }

    // 3. Seed default Minecraft port allocations (25565..25575) if none exist
    const allocCount = await db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM allocations');
    if (!allocCount || allocCount.cnt === 0) {
        for (let port = 25565; port <= 25575; port++) {
            await db.execute('INSERT INTO allocations (node_id, ip, port, notes) VALUES (1, ?, ?, ?)', [
                '0.0.0.0',
                port,
                port === 25565 ? 'Default Minecraft Port' : null,
            ]);
        }
    }

    // 4. Seed Minecraft Nest & Eggs
    let nest = await db.queryOne<{ id: number }>('SELECT id FROM nests WHERE name = ?', ['Minecraft']);
    if (!nest) {
        const res = await db.execute('INSERT INTO nests (uuid, author, name, description) VALUES (?, ?, ?, ?)', [
            crypto.randomUUID(),
            'support@pterodactyl.io',
            'Minecraft',
            'Minecraft - the classic game from Mojang. Run Vanilla, Paper, Purpur, Spigot, Fabric, Forge, NeoForge, or Folia.',
        ]);
        nest = { id: res.insertId };
    }

    for (const def of MINECRAFT_EGGS) {
        const existingEgg = await db.queryOne<{ id: number; docker_images: string }>(
            'SELECT id, docker_images FROM eggs WHERE nest_id = ? AND software_type = ?',
            [nest.id, def.softwareType]
        );
        if (existingEgg) {
            try {
                const parsed = JSON.parse(existingEgg.docker_images || '{}') as Record<string, string>;
                let updated = false;
                for (const [label, image] of Object.entries(def.dockerImages)) {
                    if (!(label in parsed)) {
                        parsed[label] = image;
                        updated = true;
                    }
                }
                if (updated) {
                    await db.execute('UPDATE eggs SET docker_images = ? WHERE id = ?', [
                        JSON.stringify(parsed),
                        existingEgg.id,
                    ]);
                }
            } catch {
                // ignore malformed custom docker_images JSON
            }
        } else {
            const eggRes = await db.execute(
                `INSERT INTO eggs (
                    uuid, nest_id, author, name, description, features, docker_images,
                    file_denylist, startup, config_files, config_startup, config_logs, config_stop, software_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    crypto.randomUUID(),
                    nest.id,
                    'parker@pterodactyl.io',
                    def.name,
                    def.description,
                    JSON.stringify(['eula', 'java_version', 'pid_limit']),
                    JSON.stringify(def.dockerImages),
                    JSON.stringify([]),
                    def.startup,
                    JSON.stringify(def.configFiles),
                    JSON.stringify(def.configStartup),
                    JSON.stringify({}),
                    def.configStop,
                    def.softwareType,
                ]
            );
            for (const v of def.variables) {
                await db.execute(
                    `INSERT INTO egg_variables (
                        egg_id, name, description, env_variable, default_value, user_viewable, user_editable, rules
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        eggRes.insertId,
                        v.name,
                        v.description,
                        v.env_variable,
                        v.default_value,
                        v.user_viewable ? 1 : 0,
                        v.user_editable ? 1 : 0,
                        v.rules,
                    ]
                );
            }
        }
    }

    // 4b. Seed generic application nests (templates only; runtime support depends on the node engine).
    const genericNests = [
        {
            name: 'Node.js',
            description: 'Node.js application templates. Requires a compatible Node.js container runtime.',
            eggs: [{
                name: 'Node.js Generic',
                softwareType: 'nodejs',
                description: 'Run a Node.js application from a Git repository or uploaded files.',
                startup: 'if [ -f package.json ]; then npm install; fi; node {{MAIN_FILE}}',
                dockerImages: {
                    'Node.js 22': 'ghcr.io/ptero-eggs/yolks:nodejs_22',
                    'Node.js 20': 'ghcr.io/ptero-eggs/yolks:nodejs_20',
                },
                variables: [
                    { name: 'Main file', description: 'Application entry file.', env_variable: 'MAIN_FILE', default_value: 'index.js', user_viewable: true, user_editable: true, rules: 'required|string|max:128' },
                    { name: 'Install packages', description: 'Extra npm packages to install.', env_variable: 'NODE_PACKAGES', default_value: '', user_viewable: true, user_editable: true, rules: 'nullable|string' },
                ],
            }],
        },
        {
            name: 'Python',
            description: 'Python application templates. Requires a compatible Python container runtime.',
            eggs: [{
                name: 'Python Generic',
                softwareType: 'python',
                description: 'Run a Python application with optional requirements.txt dependencies.',
                startup: 'if [ -f requirements.txt ]; then pip install -r requirements.txt; fi; python {{PY_FILE}}',
                dockerImages: {
                    'Python 3.12': 'ghcr.io/ptero-eggs/yolks:python_3.12',
                    'Python 3.11': 'ghcr.io/ptero-eggs/yolks:python_3.11',
                },
                variables: [
                    { name: 'App file', description: 'Python entry file.', env_variable: 'PY_FILE', default_value: 'app.py', user_viewable: true, user_editable: true, rules: 'required|string|max:128' },
                ],
            }],
        },
    ];

    for (const genericNest of genericNests) {
        let genericNestRow = await db.queryOne<{ id: number }>('SELECT id FROM nests WHERE name = ?', [genericNest.name]);
        if (!genericNestRow) {
            const nestResult = await db.execute(
                'INSERT INTO nests (uuid, author, name, description) VALUES (?, ?, ?, ?)',
                [crypto.randomUUID(), 'sourajitvfx@gmail.com', genericNest.name, genericNest.description]
            );
            genericNestRow = { id: nestResult.insertId };
        }
        for (const def of genericNest.eggs) {
            const existing = await db.queryOne<{ id: number }>(
                'SELECT id FROM eggs WHERE nest_id = ? AND software_type = ?',
                [genericNestRow.id, def.softwareType]
            );
            if (existing) continue;
            const eggResult = await db.execute(
                `INSERT INTO eggs (
                    uuid, nest_id, author, name, description, features, docker_images,
                    file_denylist, startup, config_files, config_startup, config_logs, config_stop, software_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    crypto.randomUUID(), genericNestRow.id, 'sourajitvfx@gmail.com',
                    def.name, def.description, JSON.stringify([]), JSON.stringify(def.dockerImages),
                    JSON.stringify([]), def.startup, JSON.stringify({}), JSON.stringify({}),
                    JSON.stringify({}), 'stop', def.softwareType,
                ]
            );
            for (const v of def.variables) {
                await db.execute(
                    `INSERT INTO egg_variables (
                        egg_id, name, description, env_variable, default_value, user_viewable, user_editable, rules
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        eggResult.insertId, v.name, v.description, v.env_variable, v.default_value,
                        v.user_viewable ? 1 : 0, v.user_editable ? 1 : 0, v.rules,
                    ]
                );
            }
        }
    }

    // 5. Seed default settings
    const defaultSettings: Record<string, string> = {
        'settings:app:name': config.appName,
        'settings:app:locale': 'en',
        'settings:pterodactyl:auth:2fa_required': '0',
        'settings:pterodactyl:mail:mailers:smtp:host': '',
        'settings:pterodactyl:mail:mailers:smtp:port': '587',
        'settings:pterodactyl:mail:from:address': 'no-reply@pterodactyl.local',
        'settings:pterodactyl:mail:from:name': config.appName,
        'settings:java:default_path': config.defaultJavaPath || '',
    };
    for (const [k, v] of Object.entries(defaultSettings)) {
        const exists = await db.queryOne<{ id: number }>('SELECT id FROM settings WHERE `key` = ?', [k]);
        if (!exists) {
            await db.execute('INSERT INTO settings (`key`, value) VALUES (?, ?)', [k, v]);
        }
    }
}
