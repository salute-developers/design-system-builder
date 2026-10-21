import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from '../../api/http';
import { getDraftAutosaveStatus } from '../../api/draftAutosaveActivity';
import type { SizeTokenRepository } from './application/sizeTokenRepository';
import { createHttpSizeTokenRepository } from './data/httpSizeTokenRepository';
import { pendingSizeTokenPrefix } from './data/localPendingSizeTokenCommands';
import { restorePendingSizeTokenCommands, setSizeTokenRepository, sizeTokenSession } from './sessions';
import type { SizeTokenValue } from './domain';

const context = { projectId: 'p1', designSystemId: 'ds', tenantId: 't-replay' };
const base = '/api/projects/p1/ds/tenants/t-replay/size-tokens';
const layer = { offsetX: 0, offsetY: 8, blur: 24, spread: -8, color: '#0000001F' };
const stored = () =>
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? '')
        .filter((key) => key.startsWith(pendingSizeTokenPrefix(context)))
        .map((key) => JSON.parse(localStorage.getItem(key)!));

/** Страница с операцией, ответ на которую не придёт: её закроют до подтверждения. */
const closedPage = () => {
    const http = createHttpSizeTokenRepository();
    const repository: SizeTokenRepository = {
        load: http.load,
        command: http.command,
        send: () => new Promise(() => undefined),
    };
    setSizeTokenRepository(repository);
    return sizeTokenSession(context);
};

/** Следующее открытие темы: новая сессия с настоящим HTTP-адаптером. */
const reopenTheme = () => {
    setSizeTokenRepository(createHttpSizeTokenRepository());
    restorePendingSizeTokenCommands(context);
};

const edit = async (value: SizeTokenValue, tokenId = 'round-l') => {
    const session = closedPage();
    session.autosave.schedule(tokenId, () => ({ type: 'update', tokenId, value }));
    await vi.advanceTimersByTimeAsync(400);
};

describe('повтор неподтверждённых команд токенов размеров при открытии темы', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('повторяет правку тем же телом и базовыми редакциями и снимает команду после ответа', async () => {
        await edit({ kind: 'dimension', valuePx: 14, platforms: {} });
        const [command] = stored();
        expect(command).toMatchObject({ method: 'PUT', path: `${base}/round-l/value` });
        const put = vi.spyOn(http, 'put').mockResolvedValue({
            data: { kind: 'radius', token: { tokenId: 'round-l', name: 'round.l', valuePx: 14 }, values: [] },
            headers: {},
        });
        reopenTheme();
        expect(getDraftAutosaveStatus(context)).not.toBe('saved');
        await vi.advanceTimersByTimeAsync(0);
        expect(put).toHaveBeenCalledWith(`${base}/round-l/value`, command.body, { headers: undefined });
        expect(command.body).toEqual({
            valuePx: 14,
            platforms: {},
            baseRevisions: { web: 0, ios: 0, android: 0 },
        });
        expect(stored()).toEqual([]);
        expect(getDraftAutosaveStatus(context)).toBe('saved');
    });

    it('повторяет добавленное своё значение платформы с platforms', async () => {
        await edit({ kind: 'dimension', valuePx: 16, platforms: { android: 18 } });
        const put = vi.spyOn(http, 'put').mockResolvedValue({ data: { kind: 'radius', token: {}, values: [] } });
        reopenTheme();
        await vi.advanceTimersByTimeAsync(0);
        expect(put.mock.calls[0][1]).toMatchObject({ valuePx: 16, platforms: { android: 18 } });
    });

    it('повторяет удаление своего значения платформы телом без этой платформы', async () => {
        await edit({ kind: 'shadow', layers: [layer], fallbackElevation: 4, platforms: {} }, 'down-hard-m');
        const put = vi.spyOn(http, 'put').mockResolvedValue({ data: { kind: 'shadow', token: {}, values: [] } });
        reopenTheme();
        await vi.advanceTimersByTimeAsync(0);
        expect(put.mock.calls[0][0]).toBe(`${base}/down-hard-m/value`);
        expect(put.mock.calls[0][1]).toMatchObject({ layers: [layer], fallbackElevation: 4, platforms: {} });
    });

    it('повторяет создание с прежним ключом повторяемости', async () => {
        const session = closedPage();
        void session.autosave.run({
            type: 'create',
            request: {
                kind: 'shadow',
                name: 'xl',
                variants: [{ variant: 'down.soft', layers: [layer], fallbackElevation: 2 }],
            },
        });
        await vi.advanceTimersByTimeAsync(0);
        const [command] = stored();
        expect(command).toMatchObject({ method: 'POST', idempotencyKey: expect.any(String) });
        const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { kind: 'shadow', created: [] } });
        reopenTheme();
        await vi.advanceTimersByTimeAsync(0);
        expect(post).toHaveBeenCalledWith(base, command.body, {
            headers: { 'Idempotency-Key': command.idempotencyKey },
        });
        expect(stored()).toEqual([]);
    });

    it('не повторяет команды при открытии опубликованной версии', async () => {
        await edit({ kind: 'dimension', valuePx: 14, platforms: {} });
        const put = vi.spyOn(http, 'put');
        setSizeTokenRepository(createHttpSizeTokenRepository());
        restorePendingSizeTokenCommands({ ...context, versionId: 'v1' });
        await vi.advanceTimersByTimeAsync(0);
        expect(put).not.toHaveBeenCalled();
        expect(stored()).toHaveLength(1);
    });
});
