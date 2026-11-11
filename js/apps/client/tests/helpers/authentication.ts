import { expect } from '@playwright/test';
import type { BrowserContextOptions } from '@playwright/test';
import type { Environment } from '../config/environment.ts';

type TrackWrite = (send: () => Promise<Response>) => Promise<Response>;

export type Session = Readonly<{
    accessToken: string;
    subject: string;
    admin: boolean;
    storageState: Exclude<BrowserContextOptions['storageState'], string | undefined>;
    close(): Promise<void>;
    trackWrite?: TrackWrite;
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

const retryableReadErrors = new Set([
    'ECONNRESET',
    'ECONNABORTED',
    'EPIPE',
    'ETIMEDOUT',
    'UND_ERR_SOCKET',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_BODY_TIMEOUT',
]);

function readFailureCode(error: unknown): string | undefined {
    if (!(error instanceof Error)) return;
    if (error.name === 'TimeoutError') return 'TIMEOUT';
    const { code, cause } = error as Error & { code?: unknown; cause?: { code?: unknown } };
    const value = cause?.code ?? code;
    if (typeof value === 'string' && retryableReadErrors.has(value)) return value;
}

/** Node fetch не записывает Authorization и OAuth form в автоматические шаги Playwright. */
async function httpRequest(
    url: string,
    options: RequestInit,
    allowed: readonly number[],
    timeout: number,
    trackWrite?: TrackWrite,
): Promise<Response> {
    const isRead = options.method === 'GET';
    const maxAttempts = isRead ? 2 : 1;
    const deadline = performance.now() + timeout * maxAttempts;
    const label = options.method + ' ' + new URL(url).pathname;
    for (let attempt = 1; ; attempt += 1) {
        const started = performance.now();
        const remaining = Math.ceil(deadline - started);
        if (remaining <= 0) throw new Error(label + ': превышено общее время ожидания; данные запроса скрыты.');
        const signal = AbortSignal.timeout(Math.min(timeout, remaining));
        const send = async () => {
            const received = await fetch(url, { ...options, redirect: 'manual', signal });
            const bufferBody = trackWrite !== undefined || (isRead && allowed.includes(received.status));
            if (!bufferBody || received.body === null) return received;
            // Ответ записи подтверждён только после чтения тела, включая ошибочный HTTP-статус.
            return new Response(await received.arrayBuffer(), {
                status: received.status,
                statusText: received.statusText,
                headers: received.headers,
            });
        };
        const attemptResponse = trackWrite ? trackWrite(send) : send();
        let response: Response;
        try {
            response = await attemptResponse;
        } catch (error) {
            const code = signal.aborted && signal.reason?.name === 'TimeoutError' ? 'TIMEOUT' : readFailureCode(error);
            const retry = isRead && attempt < maxAttempts && code !== undefined && performance.now() < deadline;
            const elapsed = Math.round(performance.now() - started);
            console.warn(
                `[e2e:http] ${label}; попытка ${attempt}/${maxAttempts}; ${elapsed} ms; ${code ?? 'NETWORK_ERROR'}; ${retry ? 'повтор GET' : 'отказ'}.`,
            );
            if (retry) continue;
            const reason = code === 'TIMEOUT' ? 'превышено время ожидания' : 'сетевая ошибка';
            throw new Error(label + ': ' + reason + '; данные запроса скрыты.');
        }
        if (!allowed.includes(response.status)) {
            await response.body?.cancel();
            throw new Error(label + ': HTTP ' + response.status + '.');
        }
        if (attempt > 1) {
            console.info(
                `[e2e:http] ${label}; попытка ${attempt}/${maxAttempts}; ${Math.round(performance.now() - started)} ms; восстановлен GET после сетевой ошибки.`,
            );
        }
        return response;
    }
}

/** Технический GET: до двух сетевых попыток; POST/PATCH/DELETE и redirect не повторяются. */
export function authenticatedRequest(
    session: Session,
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    allowed: readonly number[],
    data?: unknown,
    idempotencyKey?: string,
): Promise<Response> {
    const headers = new Headers({ Authorization: 'Bearer ' + session.accessToken, 'Cache-Control': 'no-store' });
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    const body = JSON.stringify(data);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const trackWrite = method === 'GET' ? undefined : session.trackWrite;
    return httpRequest(url, { method, headers, body }, allowed, method === 'GET' ? 10000 : 30000, trackWrite);
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
