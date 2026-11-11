import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** Передаёт сборке только публичные настройки того же E2E-стенда. */
export async function builtUIEnvironment(input) {
    const client = fileURLToPath(new URL('../', import.meta.url));
    const file = input.DSB_E2E_CREDENTIALS_FILE
        ? resolve(client, input.DSB_E2E_CREDENTIALS_FILE)
        : new URL('../.env.e2e.local', import.meta.url);
    let local = {};
    try {
        local = parseEnv(await readFile(file, 'utf8'));
    } catch (error) {
        if (input.DSB_E2E_CREDENTIALS_FILE || error.code !== 'ENOENT') {
            throw new Error('Не удалось прочитать E2E-настройки для сборки; содержимое файла скрыто.');
        }
    }
    const values = { ...local, ...input };
    let gateway;
    try {
        gateway = new URL(values.DSB_E2E_GATEWAY_BASE_URL?.trim() || 'http://localhost:8080/');
    } catch {
        throw new Error('Некорректный DSB_E2E_GATEWAY_BASE_URL; значение скрыто.');
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(gateway.hostname);
    assert(
        (loopback ? ['http:', 'https:'] : ['https:']).includes(gateway.protocol) &&
            [gateway.username, gateway.password, gateway.search, gateway.hash].every((part) => part === ''),
        'Gateway сборки должен использовать HTTPS либо локальный HTTP, без credentials/query/fragment.',
    );
    return {
        DSB_E2E_CLIENT_BASE_URL: 'http://localhost:4173/',
        VITE_API_GATEWAY_URL: gateway.href.replace(/\/$/u, ''),
        VITE_CLIENT_ID: values.DSB_E2E_CLIENT_ID?.trim() || 'dsbuilder-api',
        VITE_PALETTE_SOURCE: 'api',
        VITE_COMPONENT_EDITOR_ENABLED: input.VITE_COMPONENT_EDITOR_ENABLED ?? 'true',
        VITE_COMPOSE_PREVIEW_PLUGIN_URL: input.VITE_COMPOSE_PREVIEW_PLUGIN_URL ?? '',
        VITE_WEB_PREVIEW_PLUGIN_URL: input.VITE_WEB_PREVIEW_PLUGIN_URL ?? '',
    };
}
