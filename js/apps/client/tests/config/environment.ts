import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { readCredentials } from './credentials.ts';
import type { Credentials } from './credentials.ts';

export type Environment = Readonly<{
    clientBaseURL: string;
    gatewayBaseURL: string;
    clientId: string;
    projectName: string;
    credentials: Credentials;
}>;

function baseURL(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error('Некорректный URL стенда; значение скрыто.');
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    assert(
        (local ? ['http:', 'https:'] : ['https:']).includes(url.protocol),
        'Адрес стенда должен быть HTTPS либо локальным HTTP.',
    );
    assert(
        [url.username, url.password, url.search, url.hash].every((part) => part === ''),
        'URL стенда не должен содержать credentials, query и fragment.',
    );
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
}

/** Настройки читаются только при выполнении теста; types/--list не требуют стенда. */
export async function readEnvironment(input: NodeJS.ProcessEnv = process.env): Promise<Environment> {
    let values = { ...input };
    const file = input.DSB_E2E_CREDENTIALS_FILE ?? new URL('../../.env.e2e.local', import.meta.url);
    try {
        values = { ...parseEnv(await readFile(file, 'utf8')), ...input };
    } catch (error) {
        if (input.DSB_E2E_CREDENTIALS_FILE || (error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw new Error(
                'Не удалось прочитать E2E credentials. Проверьте .env.e2e.local или DSB_E2E_CREDENTIALS_FILE.',
            );
        }
    }
    assert(
        values.DSB_E2E_ALLOW_MUTATIONS === 'true',
        'Разрешите DSB_E2E_ALLOW_MUTATIONS=true для тестового стенда в .env.e2e.local.',
    );
    assert(values.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'Проверка TLS должна оставаться включённой.');
    const projectName = values.DSB_E2E_PROJECT_NAME?.trim() || 'E2E Automation';
    assert(projectName.length <= 120, 'DSB_E2E_PROJECT_NAME должен быть не длиннее 120 символов.');
    return {
        clientBaseURL: baseURL(values.DSB_E2E_CLIENT_BASE_URL?.trim() || 'http://localhost:3002/'),
        gatewayBaseURL: baseURL(values.DSB_E2E_GATEWAY_BASE_URL?.trim() || 'http://localhost:8080/'),
        clientId: values.DSB_E2E_CLIENT_ID?.trim() || 'dsbuilder-api',
        projectName,
        credentials: readCredentials(values),
    };
}
