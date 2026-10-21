import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SizeTokenValue } from '../domain';
import { createSizeTokenAutosave } from './autosave';
import {
    SizeTokenOperationError,
    type PendingSizeTokenCommands,
    type SizeTokenCommand,
    type SizeTokenOperation,
    type SizeTokenResult,
} from './sizeTokenRepository';

const context = { projectId: 'p', designSystemId: 'd', tenantId: 't' };
const dimension = (valuePx: number, platforms: Partial<Record<'ios' | 'android', number>> = {}): SizeTokenValue => ({
    kind: 'dimension',
    valuePx,
    platforms,
});

/** Хранилище команд в памяти, как `localStorage` темы. */
const memoryStore = (): PendingSizeTokenCommands & { items: Map<string, SizeTokenCommand> } => {
    const items = new Map<string, SizeTokenCommand>();
    return {
        items,
        save: (key, command) => void items.set(key, command),
        remove: (key, commandId) => {
            if (!commandId || items.get(key)?.id === commandId) items.delete(key);
        },
        list: () => [...items].map(([key, command]) => ({ key, command })),
    };
};

let revision = 0;
/** Порт с командой, как у HTTP-адаптера: базовая редакция — текущая на момент построения команды. */
const port = (send: (command: SizeTokenCommand) => Promise<SizeTokenResult>) => {
    const command = vi.fn((_: unknown, operation: SizeTokenOperation): SizeTokenCommand => {
        const id = `c${Math.random()}`;
        if (operation.type === 'update')
            return {
                id,
                operation: 'update',
                method: 'PUT',
                path: `/size-tokens/${operation.tokenId}/value`,
                body: { ...operation.value, baseRevisions: { web: revision } },
                tokenId: operation.tokenId,
            };
        if (operation.type === 'create')
            return {
                id,
                operation: 'create',
                method: 'POST',
                path: '/size-tokens',
                body: operation.request,
                idempotencyKey: `key-${id}`,
            };
        return {
            id,
            operation: 'delete',
            method: 'DELETE',
            path: `/size-tokens/${operation.tokenId}`,
            tokenId: operation.tokenId,
        };
    });
    return { command, send: vi.fn((_: unknown, sent: SizeTokenCommand) => send(sent)) };
};

const updated = (): SizeTokenResult => ({ type: 'update', token: {} as never, values: [] });

describe('очередь автосохранения токенов размеров', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        revision = 0;
    });
    afterEach(() => vi.useRealTimers());

    it('объединяет правки за 400 мс в одну операцию с базовыми редакциями в момент отправки', async () => {
        const repository = port(async () => updated());
        const store = memoryStore();
        const onSaved = vi.fn();
        const autosave = createSizeTokenAutosave({ repository, context, store, onSaved });
        let value = dimension(13);
        autosave.schedule('r1', () => ({ type: 'update', tokenId: 'r1', value }));
        // Команда хранится сразу: страница может закрыться раньше отправки.
        expect(store.items.get('r1')?.body).toMatchObject({ valuePx: 13 });
        await vi.advanceTimersByTimeAsync(300);
        value = dimension(14, { android: 18 });
        autosave.schedule('r1', () => ({ type: 'update', tokenId: 'r1', value }));
        revision = 7;
        expect(autosave.status('r1').state).toBe('pending');
        await vi.advanceTimersByTimeAsync(400);
        expect(repository.send).toHaveBeenCalledTimes(1);
        expect(repository.send.mock.calls[0][1].body).toEqual({
            kind: 'dimension',
            valuePx: 14,
            platforms: { android: 18 },
            baseRevisions: { web: 7 },
        });
        expect(onSaved).toHaveBeenCalledWith('r1', expect.objectContaining({ type: 'update' }), true);
        expect(autosave.overall().state).toBe('saved');
        expect(store.items.size).toBe(0);
    });

    it('правку во время отправки отправляет следующим поколением, ответ старого запроса её не снимает', async () => {
        let finish: (result: SizeTokenResult) => void = () => undefined;
        const repository = port(() => new Promise((resolve) => (finish = resolve)));
        const store = memoryStore();
        const onSaved = vi.fn();
        const autosave = createSizeTokenAutosave({ repository, context, store, onSaved });
        autosave.schedule('r1', () => ({ type: 'update', tokenId: 'r1', value: dimension(13) }));
        await vi.advanceTimersByTimeAsync(400);
        expect(autosave.status('r1').state).toBe('saving');
        autosave.schedule('r1', () => ({ type: 'update', tokenId: 'r1', value: dimension(15) }));
        finish(updated());
        await vi.advanceTimersByTimeAsync(0);
        expect(onSaved).toHaveBeenLastCalledWith('r1', expect.anything(), false);
        expect(autosave.hasUnsaved()).toBe(true);
        expect(store.items.get('r1')?.body).toMatchObject({ valuePx: 15 });
        await vi.advanceTimersByTimeAsync(400);
        finish(updated());
        await vi.advanceTimersByTimeAsync(0);
        expect(repository.send).toHaveBeenCalledTimes(2);
        expect(repository.send.mock.calls[1][1].body).toMatchObject({ valuePx: 15 });
        expect(autosave.hasUnsaved()).toBe(false);
        expect(store.items.size).toBe(0);
    });

    it('повторяет ошибки сети и 5xx через 1 с с удвоением до 30 с, «Повторить» — сразу', async () => {
        const failure = new SizeTokenOperationError('network', 'Сервис недоступен');
        const send = vi.fn<(command: SizeTokenCommand) => Promise<SizeTokenResult>>().mockRejectedValue(failure);
        const repository = port(send);
        const store = memoryStore();
        const autosave = createSizeTokenAutosave({ repository, context, store, retryMaxMs: 4_000 });
        autosave.schedule('r1', () => ({ type: 'update', tokenId: 'r1', value: dimension(15) }));
        await vi.advanceTimersByTimeAsync(400);
        expect(autosave.status('r1')).toEqual({ state: 'error', error: failure });
        await vi.advanceTimersByTimeAsync(999);
        expect(send).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(send).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(send).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(4_000);
        expect(send).toHaveBeenCalledTimes(4);
        // Не больше наибольшей задержки.
        await vi.advanceTimersByTimeAsync(4_000);
        expect(send).toHaveBeenCalledTimes(5);
        // Неподтверждённая команда остаётся в хранилище до ответа.
        expect(store.items.has('r1')).toBe(true);
        send.mockResolvedValue(updated());
        autosave.retry();
        await vi.advanceTimersByTimeAsync(0);
        expect(send).toHaveBeenCalledTimes(6);
        expect(autosave.overall().state).toBe('saved');
        expect(store.items.size).toBe(0);
    });

    it('снимает с очереди и из хранилища значение, отклонённое проверкой сервера', async () => {
        const failure = new SizeTokenOperationError(
            'invalid',
            'Значение должно быть в диапазоне 0–1000 px.',
            'INVALID_SIZE_VALUE',
            'valuePx',
        );
        const repository = port(async () => Promise.reject(failure));
        const store = memoryStore();
        const onRejected = vi.fn();
        const autosave = createSizeTokenAutosave({ repository, context, store, onRejected });
        autosave.schedule('r1', () => ({ type: 'update', tokenId: 'r1', value: dimension(1200) }));
        await vi.advanceTimersByTimeAsync(400);
        expect(onRejected).toHaveBeenCalledWith('r1', failure, expect.objectContaining({ tokenId: 'r1' }));
        expect(autosave.overall().state).toBe('saved');
        expect(store.items.size).toBe(0);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(repository.send).toHaveBeenCalledTimes(1);
    });

    it('повторяет сохранённую команду без изменений', async () => {
        const repository = port(async () => updated());
        const store = memoryStore();
        const autosave = createSizeTokenAutosave({ repository, context, store });
        const command: SizeTokenCommand = {
            id: 'old',
            operation: 'update',
            method: 'PUT',
            path: '/size-tokens/r1/value',
            body: { valuePx: 16, platforms: { android: 18 }, baseRevisions: { web: 3, ios: 3, android: 2 } },
            tokenId: 'r1',
        };
        store.save('r1', command);
        autosave.replay('r1', command);
        await vi.advanceTimersByTimeAsync(0);
        expect(repository.command).not.toHaveBeenCalled();
        expect(repository.send.mock.calls[0][1]).toBe(command);
        expect(store.items.size).toBe(0);
    });

    it('создаёт после отправки очереди и повторяет создание тем же ключом и телом', async () => {
        const order: string[] = [];
        const network = new SizeTokenOperationError('network', 'Сервис недоступен');
        let failCreate = true;
        const repository = port(async (command) => {
            order.push(command.operation);
            if (command.operation === 'create' && failCreate) {
                failCreate = false;
                throw network;
            }
            return command.operation === 'create' ? { type: 'create', created: [] } : updated();
        });
        const store = memoryStore();
        const autosave = createSizeTokenAutosave({ repository, context, store });
        autosave.schedule('r1', () => ({ type: 'update', tokenId: 'r1', value: dimension(15) }));
        const created = autosave.run({ type: 'create', request: { kind: 'radius', name: 'xxxl', valuePx: 40 } });
        await vi.advanceTimersByTimeAsync(0);
        expect(order).toEqual(['update', 'create']);
        const [key] = [...store.items.keys()];
        expect(key).toMatch(/^create:key-/);
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(created).resolves.toEqual({ type: 'create', created: [] });
        const [first, second] = repository.send.mock.calls.slice(1).map(([, command]) => command);
        expect(second).toBe(first);
        expect(store.items.size).toBe(0);
    });

    it('отклоняет удаление с ошибкой сервера', async () => {
        const failure = new SizeTokenOperationError('forbidden', 'Нет прав');
        const repository = port(async () => Promise.reject(failure));
        const autosave = createSizeTokenAutosave({ repository, context, store: memoryStore() });
        await expect(autosave.run({ type: 'delete', tokenId: 'r1' })).rejects.toBe(failure);
    });
});
