import { CLIENT_ID, GATEWAY_URL, REALM } from '../config';

/** Пара токенов из token endpoint. */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

/** Срок запроса выхода: зависший сервер не должен держать очистку сессии. */
const LOGOUT_TIMEOUT_MS = 5_000;

/** Ответ endpoint устройства. */
export interface DeviceAuthorization {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    intervalSeconds: number;
    expiresInSeconds: number;
}

/** Сервер недоступен или ответил `5xx`: сессию терять нельзя, запрос можно повторить. */
export class TransportError extends Error {}

/** Отказ OAuth с кодом ошибки из ответа, например `invalid_grant`. */
export class OAuthError extends Error {
    constructor(readonly code: string) {
        super(code);
    }
}

/** Значения RFC 8628, если сервер их не вернул. */
const DEFAULT_INTERVAL_SECONDS = 5;
const DEFAULT_EXPIRES_IN_SECONDS = 600;

const form = (values: Record<string, string>) => new URLSearchParams({ client_id: CLIENT_ID, ...values });

const post = async (path: string, body: URLSearchParams, fetcher: typeof fetch, signal?: AbortSignal) => {
    let response: Response;
    try {
        response = await fetcher(`${GATEWAY_URL}${path}`, { method: 'POST', body, signal });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new TransportError('Сервер DS Builder недоступен');
    }
    if (response.status >= 500) throw new TransportError(`Сервер DS Builder ответил ${response.status}`);
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new OAuthError(typeof data.error === 'string' ? data.error : `http_${response.status}`);
    return data;
};

const text = (value: unknown) => {
    if (typeof value === 'string' && value) return value;
    throw new TransportError('Сервер DS Builder вернул неполный ответ');
};

const positive = (value: unknown, fallback: number) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
};

/** Токены из ответа; без нового refresh token остаётся [currentRefreshToken], пустых токенов в сессии не бывает. */
const tokenPair = (data: Record<string, unknown>, currentRefreshToken?: string): TokenPair => ({
    accessToken: text(data.access_token),
    refreshToken: text(data.refresh_token ?? currentRefreshToken),
});

/** Вызовы Keycloak через публичный gateway. */
export interface AuthEndpoints {
    requestDeviceCode(): Promise<DeviceAuthorization>;
    exchangeDeviceCode(deviceCode: string, signal?: AbortSignal): Promise<TokenPair>;
    refresh(refreshToken: string): Promise<TokenPair>;
    logout(refreshToken: string): Promise<void>;
}

export const createAuthEndpoints = (fetcher: typeof fetch = (...args) => fetch(...args)): AuthEndpoints => ({
    requestDeviceCode: async () => {
        const data = await post(
            `/realms/${REALM}/protocol/openid-connect/auth/device`,
            form({ scope: 'openid profile offline_access' }),
            fetcher,
        );
        return {
            deviceCode: text(data.device_code),
            userCode: text(data.user_code),
            verificationUri: text(data.verification_uri_complete ?? data.verification_uri),
            intervalSeconds: positive(data.interval, DEFAULT_INTERVAL_SECONDS),
            expiresInSeconds: positive(data.expires_in, DEFAULT_EXPIRES_IN_SECONDS),
        };
    },
    exchangeDeviceCode: async (deviceCode, signal) =>
        tokenPair(
            await post(
                '/auth/token',
                form({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode }),
                fetcher,
                signal,
            ),
        ),
    refresh: async (refreshToken) =>
        tokenPair(
            await post('/auth/token', form({ grant_type: 'refresh_token', refresh_token: refreshToken }), fetcher),
            refreshToken,
        ),
    logout: async (refreshToken) => {
        await post(
            '/auth/logout',
            form({ refresh_token: refreshToken }),
            fetcher,
            AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
        );
    },
});
