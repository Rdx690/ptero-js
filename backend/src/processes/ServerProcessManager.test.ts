import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { computeDirectorySizeAsync, formatJtgConsoleLine, SOURAJITVFX_TERMINAL_PRELUDE } from './ServerProcessManager';

test('computeDirectorySizeAsync sums nested files cleanly and handles missing directories', async () => {
    assert.equal(await computeDirectorySizeAsync(path.join(os.tmpdir(), 'definitely-missing-dir-xyz')), 0);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptero-size-'));
    try {
        fs.mkdirSync(path.join(tmpDir, 'world', 'region'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'server.jar'), Buffer.alloc(1024, 1));
        fs.writeFileSync(path.join(tmpDir, 'world', 'region', 'r.0.0.mca'), Buffer.alloc(2048, 2));
        const total = await computeDirectorySizeAsync(tmpDir);
        assert.equal(total, 3072);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('formatJtgConsoleLine outputs the SOURAJITVFX terminal prefix', () => {
    const line = formatJtgConsoleLine('Server marked as running!');
    assert.ok(line.startsWith(JTG_TERMINAL_PRELUDE));
    assert.ok(line.includes('container@SOURAJITVFX~ '));
    assert.ok(line.endsWith('Server marked as running!\u001b[0m'));
});
