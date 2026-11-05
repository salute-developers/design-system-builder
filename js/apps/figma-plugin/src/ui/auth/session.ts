import type { PluginStorage } from '../bridge';
import { OAuthError, type AuthEndpoints, type TokenPair } from './authEndpoints';

const REFRESH_TOKEN_KEY = 'refresh-token';

/**
 * Сессия пользователя: refresh token хранится в основном потоке, access token — только в памяти окна. Сетевая ошибка
 * обновления сессию не сбрасывает, а `invalid_grant` сбрасывает.
 */
/** Ответы Keycloak, после которых токен бесполезен; `not_allowed` приходит, если у пользователя сняли роль. */
const SESSION_ENDED = ['invalid_grant', 'not_allowed'];

export class Session {
    private access: string | null = null;
    private refreshing: Promise<string> | null = null;
    /** Растёт при очистке: ответ обновления, начатого до выхода, не должен вернуть токены. */
    private generation = 0;
    private readonly listeners = new Set<() => void>();

    constructor(
        private readonly storage: PluginStorage,
        private readonly endpoints: Pick<AuthEndpoints, 'refresh' | 'logout'>,
    ) {}

    get accessToken() {
        return this.access;
    }

    /** Подписка на потерю сессии: экран возвращается ко входу. */
    onExpired(listener: () => void) {
        this.listeners.add(listener);
        return () => void this.listeners.delete(listener);
    }

    /** Восстанавливает сессию без браузера; `false` — сохранённого входа нет или он недействителен. */
    async restore() {
        if (!(await this.storage.get(REFRESH_TOKEN_KEY))) return false;
        try {
            await this.refresh();
            return true;
        } catch (error) {
            if (error instanceof OAuthError) return false;
            throw error;
        }
    }

    async signIn(tokens: TokenPair) {
        await this.storage.set(REFRESH_TOKEN_KEY, tokens.refreshToken);
        this.access = tokens.accessToken;
    }

    /** Обновляет access token; одновременные вызовы используют одно обновление. */
    refresh() {
        this.refreshing ??= this.renew().finally(() => {
            this.refreshing = null;
        });
        return this.refreshing;
    }

    /** Завершает сессию на сервере, если он доступен; локальные токены удаляются всегда и сразу. */
    async signOut() {
        const refreshToken = await this.storage.get(REFRESH_TOKEN_KEY).catch(() => null);
        await this.clear();
        if (refreshToken) await this.endpoints.logout(refreshToken).catch(() => undefined);
    }

    /** Сервер отверг обновлённый токен: сессии больше нет. */
    async expire() {
        await this.clear();
        this.listeners.forEach((listener) => listener());
    }

    private async renew() {
        const generation = this.generation;
        const refreshToken = await this.storage.get(REFRESH_TOKEN_KEY);
        try {
            if (!refreshToken) throw new OAuthError('invalid_grant');
            const tokens = await this.endpoints.refresh(refreshToken);
            if (generation !== this.generation) throw new OAuthError('invalid_grant');
            await this.signIn(tokens);
            return tokens.accessToken;
        } catch (error) {
            if (error instanceof OAuthError && SESSION_ENDED.includes(error.code) && generation === this.generation)
                await this.expire();
            throw error;
        }
    }

    private async clear() {
        this.generation += 1;
        this.access = null;
        await this.storage.delete(REFRESH_TOKEN_KEY).catch(() => undefined);
    }
}
