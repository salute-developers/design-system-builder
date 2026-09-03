import axios from 'axios';

import { API_GATEWAY_URL } from './constants';
import { authService } from './authService';
import { getBaseName } from '../utils/baseName';

export const http = axios.create({ baseURL: API_GATEWAY_URL });

const forceLogout = () => {
    const base = getBaseName().replace(/\/$/, '');

    window.location.href = `${base}/login`;
};

http.interceptors.request.use(async (config) => {
    try {
        const token = await authService.getValidAccessToken();

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch {
        await authService.logout();
        forceLogout();

        throw new axios.Cancel('auth refresh failed');
    }

    return config;
});

http.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;

            try {
                const token = await authService.refreshAccessToken();
                original.headers.Authorization = `Bearer ${token}`;

                return http(original);
            } catch {
                await authService.logout();
                forceLogout();

                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    },
);
