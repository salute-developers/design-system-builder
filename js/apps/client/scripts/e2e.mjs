import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtUIEnvironment } from './e2e-built-env.mjs';

// Выбор Product-режима и источника UI; остальные аргументы обрабатывает штатный Playwright CLI.
const require = createRequire(import.meta.url);
const binary = join(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const env = { ...process.env, DSB_E2E_MODE: 'product' };
const external = process.argv.includes('--external-ui');
const args = process.argv.slice(2).filter((argument) => argument !== '--external-ui');
env.DSB_E2E_EXTERNAL_UI = String(external);
if (!external && !args.some((argument) => ['--list', '--help', '-h'].includes(argument))) {
    Object.assign(env, await builtUIEnvironment(env));
}
delete env.PWDEBUG;
const result = spawnSync(process.execPath, [binary, 'test', ...args], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env,
    stdio: 'inherit',
    shell: false,
});
if (result.error) process.stderr.write('Не удалось запустить Playwright CLI.\n');
process.exitCode = result.status ?? 1;
