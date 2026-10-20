import axios, { type InternalAxiosRequestConfig } from 'axios';

import { API_GATEWAY_URL } from './constants';
import { authService } from './authService';
import { getBaseName } from '../utils/baseName';
import { getEditorClientId } from './editorClientIdentity';
import { reportIncompleteMutationMetadata } from './incompleteMutationMetadata';

export const http = axios.create({ baseURL: API_GATEWAY_URL });

type RetryConfig = InternalAxiosRequestConfig & {
    _unavailableRetries?: number;
    _sessionGeneration?: number;
    _retry?: boolean;
};
let sessionGeneration = 0;
authService.onSessionReset(() => {
    sessionGeneration += 1;
});

const retryDelay = (milliseconds: number, signal: RetryConfig['signal']) =>
    new Promise<void>((resolve, reject) => {
        const cancel = () => {
            clearTimeout(timer);
            signal?.removeEventListener?.('abort', cancel);
            reject(new axios.CanceledError());
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener?.('abort', cancel);
            resolve();
        }, milliseconds);
        signal?.addEventListener?.('abort', cancel, { once: true });
        if (signal?.aborted) cancel();
    });

const forceLogout = () => {
    const base = getBaseName().replace(/\/$/, '');

    window.location.href = `${base}/login?reason=expired`;
};

http.interceptors.request.use(async (config) => {
    const request = config as RetryConfig;
    request._sessionGeneration ??= sessionGeneration;
    if (request._sessionGeneration !== sessionGeneration) throw new axios.CanceledError('Сессия завершена');
    config.headers['X-DS-Client-Id'] = getEditorClientId();
    try {
        const token = await authService.getValidAccessToken();
        if (request._sessionGeneration !== sessionGeneration) throw new axios.CanceledError('Сессия завершена');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        if (axios.isCancel(error)) throw error;
        if (request._sessionGeneration !== sessionGeneration && authService.isAuthenticated()) {
            throw new axios.CanceledError('Сессия завершена');
        }
        await authService.logout();
        forceLogout();

        throw new axios.Cancel('auth refresh failed');
    }

    return config;
});

http.interceptors.response.use(
    (response) => {
        reportIncompleteMutationMetadata(response);
        return response;
    },
    async (error) => {
        const original = error.config as RetryConfig | undefined;
        if (original && original._sessionGeneration !== sessionGeneration && authService.isAuthenticated()) {
            return Promise.reject(new axios.CanceledError('Сессия завершена'));
        }

        // Повтор команд безопасен только с тем же ключом повторяемости и в той же сессии.
        if (
            error.response?.status === 503 &&
            original &&
            ['post', 'put', 'patch', 'delete'].includes(original.method ?? '') &&
            original.headers.get('Idempotency-Key') &&
            (original._unavailableRetries ?? 0) < 2 &&
            original._sessionGeneration === sessionGeneration
        ) {
            original._unavailableRetries = (original._unavailableRetries ?? 0) + 1;
            await retryDelay(500 * original._unavailableRetries, original.signal);
            return http(original);
        }

        if (error.response?.status === 401 && original && !original._retry) {
            original._retry = true;

            try {
                const token = await authService.refreshAccessToken();
                original.headers.Authorization = `Bearer ${token}`;

                return http(original);
            } catch {
                if (original._sessionGeneration !== sessionGeneration && authService.isAuthenticated()) {
                    return Promise.reject(new axios.CanceledError('Сессия завершена'));
                }
                await authService.logout();
                forceLogout();

                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    },
);
