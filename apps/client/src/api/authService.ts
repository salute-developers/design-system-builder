import { tokenStore } from './tokenStore';
import { refreshTokens, logoutOnServer, loginWithPassword } from './keycloak';

let refreshPromise: Promise<string> | null = null;

export const authService = {
    isAuthenticated() {
        return Boolean(tokenStore.access && tokenStore.refresh);
    },

    async login(username: string, password: string) {
        const tokens = await loginWithPassword(username, password);
        tokenStore.save(tokens);
    },

    async logout() {
        const refresh = tokenStore.refresh;
        tokenStore.clear();

        if (refresh) {
            await logoutOnServer(refresh);
        }
    },

    async getValidAccessToken(): Promise<string | null> {
        if (!tokenStore.refresh) {
            return null;
        }

        if (tokenStore.access && !tokenStore.isExpired()) {
            return tokenStore.access;
        }

        return this.refreshAccessToken();
    },

    refreshAccessToken(): Promise<string> {
        if (refreshPromise) {
            return refreshPromise;
        }

        const refresh = tokenStore.refresh;

        if (!refresh) {
            return Promise.reject(new Error('no refresh token'));
        }

        refreshPromise = refreshTokens(refresh)
            .then((tokens) => {
                tokenStore.save(tokens);
                return tokens.access_token;
            })
            .catch((err) => {
                tokenStore.clear();
                throw err;
            })
            .finally(() => {
                refreshPromise = null;
            });

        return refreshPromise;
    },
};
