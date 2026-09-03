import { AUTH_URL, CLIENT_ID, LOGOUT_URL } from './constants';

export async function loginWithPassword(username: string, password: string) {
    const body = new URLSearchParams({
        grant_type: 'password',
        client_id: CLIENT_ID,
        username,
        password,
        scope: 'openid',
    });

    const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) {
        throw new Error(`login failed: ${res.status}`);
    }

    return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function refreshTokens(refreshToken: string) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
    });

    const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) {
        throw new Error(`refresh failed: ${res.status}`);
    }

    return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function logoutOnServer(refreshToken: string) {
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
    });

    await fetch(LOGOUT_URL, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        body,
    }).catch(() => {});
}
