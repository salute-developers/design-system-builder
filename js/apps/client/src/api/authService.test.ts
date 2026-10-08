import { afterEach, describe, expect, it } from 'vitest';
import { authService } from './authService';
import { tokenStore } from './tokenStore';

const encodePayload = (payload: object) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const base64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `header.${base64}.signature`;
};

afterEach(() => tokenStore.clear());

describe('authService current user', () => {
    it('reads the current Keycloak identity from access-token claims', () => {
        tokenStore.save({
            access_token: encodePayload({
                sub: 'user-1',
                name: 'Алексей Иванов',
                preferred_username: 'alex',
                email: 'alex@example.com',
            }),
            refresh_token: 'refresh',
            expires_in: 60,
        });

        expect(authService.getCurrentUser()).toEqual({
            id: 'user-1',
            username: 'alex',
            email: 'alex@example.com',
            displayName: 'Алексей Иванов',
            initials: 'АИ',
        });
    });

    it('does not invent profile data for a malformed token', () => {
        tokenStore.save({ access_token: 'not-a-jwt', refresh_token: 'refresh', expires_in: 60 });
        expect(authService.getCurrentUser()).toBeNull();
    });
});
