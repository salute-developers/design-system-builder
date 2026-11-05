import { OAuthError } from '../auth/authEndpoints';
import type { Session } from '../auth/session';
import { GATEWAY_URL } from '../config';

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not-found' | 'network' | 'server';

/** Отказ API в терминах экрана. */
export class ApiError extends Error {
    constructor(
        readonly kind: ApiErrorKind,
        message: string,
    ) {
        super(message);
    }
}

const MESSAGES: Record<ApiErrorKind, string> = {
    unauthorized: 'Нужно войти снова',
    forbidden: 'Нет доступа',
    'not-found': 'Данные не найдены',
    network: 'Сервер DS Builder недоступен',
    server: 'Сервер DS Builder ответил ошибкой',
};

const failure = (status: number) => {
    const kind: ApiErrorKind =
        status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'server';
    return new ApiError(kind, MESSAGES[kind]);
};

export interface RequestOptions {
    params?: Record<string, string | null | undefined>;
    signal?: AbortSignal;
}

/** Адрес запроса: параметры со значением `null` не передаются. */
const url = (path: string, params: RequestOptions['params'] = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value != null && query.set(key, value));
    const suffix = query.toString();
    return `${GATEWAY_URL}${path}${suffix && `?${suffix}`}`;
};

/** GET-запросы к API с токеном сессии: `401` — одно обновление и один повтор. */
export const createHttpClient = (session: Session, fetcher: typeof fetch = (...args) => fetch(...args)) => {
    const send = async (target: string, token: string | null, signal?: AbortSignal) => {
        try {
            return await fetcher(target, { headers: { Authorization: `Bearer ${token}` }, signal });
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            throw new ApiError('network', MESSAGES.network);
        }
    };
    const refreshed = async () => {
        try {
            return await session.refresh();
        } catch (error) {
            if (error instanceof OAuthError) throw new ApiError('unauthorized', MESSAGES.unauthorized);
            throw new ApiError('network', MESSAGES.network);
        }
    };
    return {
        get: async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
            const target = url(path, options.params);
            const token = session.accessToken;
            let response = await send(target, token, options.signal);
            if (response.status === 401) {
                // Токен мог обновиться, пока шёл этот запрос: второе обновление не нужно.
                const fresh = session.accessToken;
                response = await send(target, fresh && fresh !== token ? fresh : await refreshed(), options.signal);
                if (response.status === 401) await session.expire();
            }
            if (!response.ok) throw failure(response.status);
            return (await response.json()) as T;
        },
    };
};

export type HttpClient = ReturnType<typeof createHttpClient>;
