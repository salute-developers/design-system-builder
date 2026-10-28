import { expect } from '@playwright/test';
import type { BrowserContextOptions } from '@playwright/test';
import type { Environment } from '../config/environment.ts';

export type Session = Readonly<{
    accessToken: string;
    subject: string;
    admin: boolean;
    storageState: Exclude<BrowserContextOptions['storageState'], string | undefined>;
    close(): Promise<void>;
}>;

type Token = { access_token: string; refresh_token: string; expires_in: number };
type RoleAccess = { roles?: unknown };
type Claims = {
    sub: string;
    azp: string;
    exp: number;
    realm_access?: RoleAccess;
    resource_access?: Record<string, RoleAccess>;
};

/** Node fetch не записывает Authorization и OAuth form в автоматические шаги Playwright. */
async function httpRequest(
    url: string,
    options: RequestInit,
    allowed: readonly number[],
    timeout: number,
): Promise<Response> {
    let response: Response;
    try {
        response = await fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    } catch (error) {
        const reason =
            error instanceof Error && error.name === 'TimeoutError' ? 'превышено время ожидания' : 'сетевая ошибка';
        throw new Error(options.method + ' ' + new URL(url).pathname + ': ' + reason + '; данные запроса скрыты.');
    }
    if (!allowed.includes(response.status)) {
        await response.body?.cancel();
        throw new Error(options.method + ' ' + new URL(url).pathname + ': HTTP ' + response.status + '.');
    }
    return response;
}

/** Технические запросы без автоматических повторов и переходов по redirect. */
export function authenticatedRequest(
    session: Session,
    url: string,
    method: 'GET' | 'POST' | 'DELETE',
    allowed: readonly number[],
    data?: unknown,
): Promise<Response> {
    const headers = new Headers({ Authorization: 'Bearer ' + session.accessToken, 'Cache-Control': 'no-store' });
    const body = JSON.stringify(data);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    return httpRequest(url, { method, headers, body }, allowed, method === 'GET' ? 10000 : 30000);
}

export async function authenticate(environment: Environment): Promise<Session> {
    let refreshToken: string | undefined;
    async function close(): Promise<void> {
        if (refreshToken) {
            const response = await httpRequest(
                new URL('auth/logout', environment.gatewayBaseURL).href,
                {
                    method: 'POST',
                    body: new URLSearchParams({ client_id: environment.clientId, refresh_token: refreshToken }),
                },
                [200, 204],
                10000,
            );
            await response.body?.cancel();
        }
    }
    try {
        const response = await httpRequest(
            new URL('auth/token', environment.gatewayBaseURL).href,
            {
                method: 'POST',
                body: new URLSearchParams({
                    grant_type: 'password',
                    client_id: environment.clientId,
                    ...environment.credentials,
                    scope: 'openid',
                }),
            },
            [200],
            10000,
        );
        // Ошибки разбора token JSON не выводят тело ответа или значения токенов.
        const raw = (await response.json()) as Partial<Token> | null;
        // Refresh token сохраняется до валидации: даже неполный ответ освобождает выданную сессию.
        refreshToken = typeof raw?.refresh_token === 'string' ? raw.refresh_token : undefined;
        // В recorded assertions передаются только типы/признаки: catch не удаляет ошибки шагов из HTML.
        expect(typeof raw?.access_token, 'Тип access token').toBe('string');
        expect(typeof raw?.refresh_token, 'Тип refresh token').toBe('string');
        expect(typeof raw?.expires_in, 'Тип срока сессии').toBe('number');
        const token = raw as Token;
        expect(/\S/u.test(token.access_token), 'Access token не должен быть пустым').toBe(true);
        expect(Boolean(token.refresh_token), 'Refresh token не должен быть пустым').toBe(true);
        const data = JSON.parse(
            Buffer.from(token.access_token.split('.')[1] ?? '', 'base64url').toString('utf8'),
        ) as Claims;
        expect(typeof data?.sub, 'Тип subject сессии').toBe('string');
        expect(data?.azp === environment.clientId, 'Соответствие OAuth clientId').toBe(true);
        expect(typeof data?.exp, 'Тип срока JWT').toBe('number');
        expect(Boolean(data.sub), 'Subject сессии не должен быть пустым').toBe(true);
        const expiresAt = Math.min(Date.now() + token.expires_in * 1000, data.exp * 1000);
        expect(Number.isFinite(expiresAt), 'Срок сессии должен быть конечным').toBe(true);
        expect(expiresAt, 'Тестовая сессия не должна быть истёкшей').toBeGreaterThan(Date.now());
        const roles = [data.realm_access, ...Object.values(data.resource_access ?? {})].flatMap((access) =>
            Array.isArray(access?.roles) ? access.roles : [],
        );
        return {
            accessToken: token.access_token,
            subject: data.sub,
            admin: roles.includes('system_admin'),
            storageState: {
                cookies: [],
                origins: [
                    {
                        origin: new URL(environment.clientBaseURL).origin,
                        localStorage: [
                            { name: 'auth.access_token', value: token.access_token },
                            { name: 'auth.refresh_token', value: token.refresh_token },
                            { name: 'auth.expires_at', value: String(expiresAt) },
                        ],
                    },
                ],
            },
            close,
        };
    } catch (error) {
        // Только авторизация очищает чувствительные сообщения; assertions UI сохраняются штатно.
        const safe =
            error instanceof Error && error.message.startsWith('POST /auth/token: HTTP')
                ? error
                : new Error('Не удалось получить тестовую сессию; credentials и ответ авторизации скрыты.');
        try {
            await close();
        } catch (cleanupError) {
            throw new AggregateError([safe, cleanupError], 'Авторизация и завершение сессии неуспешны.');
        }
        throw safe;
    }
}
