import { tokenStore } from './tokenStore';
import { refreshTokens, logoutOnServer, loginWithPassword } from './keycloak';

let refreshPromise: Promise<string> | null = null;
const sessionResetListeners = new Set<() => void>();
const notifySessionReset = () => sessionResetListeners.forEach((listener) => listener());

export interface CurrentUser {
    id?: string;
    username?: string;
    email?: string;
    displayName: string;
    initials: string;
}

const decodeAccessToken = (token: string): Record<string, unknown> | null => {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
        const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    } catch {
        return null;
    }
};

const stringClaim = (claims: Record<string, unknown>, name: string) =>
    typeof claims[name] === 'string' && claims[name] ? String(claims[name]) : undefined;

const userInitials = (displayName: string, username?: string, email?: string) => {
    const words = displayName.trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase('ru-RU');
    const source = words[0] || username || email || 'U';
    return source.slice(0, 2).toLocaleUpperCase('ru-RU');
};

export const authService = {
    isAuthenticated() {
        return Boolean(tokenStore.access && tokenStore.refresh);
    },

    getCurrentUser(): CurrentUser | null {
        const accessToken = tokenStore.access;
        if (!accessToken) return null;
        const claims = decodeAccessToken(accessToken);
        if (!claims) return null;
        const username = stringClaim(claims, 'preferred_username');
        const email = stringClaim(claims, 'email');
        const displayName =
            stringClaim(claims, 'name') ||
            [stringClaim(claims, 'given_name'), stringClaim(claims, 'family_name')].filter(Boolean).join(' ') ||
            username ||
            email ||
            'Пользователь';
        return {
            id: stringClaim(claims, 'sub'),
            username,
            email,
            displayName,
            initials: userInitials(displayName, username, email),
        };
    },

    async login(username: string, password: string) {
        const tokens = await loginWithPassword(username, password);
        notifySessionReset();
        tokenStore.save(tokens);
    },

    async logout() {
        const refresh = tokenStore.refresh;
        tokenStore.clear();
        notifySessionReset();

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
                notifySessionReset();
                throw err;
            })
            .finally(() => {
                refreshPromise = null;
            });

        return refreshPromise;
    },

    onSessionReset(listener: () => void) {
        sessionResetListeners.add(listener);
        return () => sessionResetListeners.delete(listener);
    },
};
