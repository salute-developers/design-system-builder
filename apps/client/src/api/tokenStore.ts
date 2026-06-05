import { ACCESS_KEY, EXPIRES_AT_KEY, REFRESH_KEY } from './constants';

export const tokenStore = {
    get access() {
        return localStorage.getItem(ACCESS_KEY);
    },

    get refresh() {
        return localStorage.getItem(REFRESH_KEY);
    },

    get expiresAt(): number | null {
        const raw = localStorage.getItem(EXPIRES_AT_KEY);

        return raw ? Number(raw) : null;
    },

    save(tokens: { access_token: string; refresh_token: string; expires_in: number }) {
        localStorage.setItem(ACCESS_KEY, tokens.access_token);
        localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
        localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + tokens.expires_in * 1000));
    },

    clear() {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(EXPIRES_AT_KEY);
    },

    isExpired(skewMs = 5000) {
        const exp = this.expiresAt;

        return exp == null || Date.now() >= exp - skewMs;
    },
};
