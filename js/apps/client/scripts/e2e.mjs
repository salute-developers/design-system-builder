import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Только выбор Product-режима; аргументы обрабатывает штатный Playwright CLI.
const require = createRequire(import.meta.url);
const binary = join(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const env = { ...process.env, DSB_E2E_MODE: 'product' };
delete env.PWDEBUG;
const result = spawnSync(process.execPath, [binary, 'test', ...process.argv.slice(2)], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), env, stdio: 'inherit', shell: false,
});
if (result.error) process.stderr.write('Не удалось запустить Playwright CLI.\n');
process.exitCode = result.status ?? 1;
