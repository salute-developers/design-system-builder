import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenAutosaveQueue, type AutosaveOperation, type AutosaveStatus } from './tokenAutosaveQueue';

type Operation = AutosaveOperation & { value: string };

const operation = (generation: string, value: string): Operation => ({
    tokenKey: 'accent',
    operationKey: 'light.accent',
    generation,
    retryCount: 0,
    value,
});

describe('TokenAutosaveQueue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('does not lose a newer change when an older request completes', async () => {
        let finishFirst: ((value: string) => void) | undefined;
        const send = vi
            .fn<(item: Operation) => Promise<string>>()
            .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
            .mockResolvedValueOnce('second');
        const confirmed: string[] = [];
        const queue = new TokenAutosaveQueue<Operation, string>({
            send,
            confirmed: (item) => confirmed.push(item.generation),
            retryable: () => false,
            statusChanged: () => undefined,
        });

        queue.enqueue(operation('first', '#111'));
        await vi.advanceTimersByTimeAsync(400);
        queue.enqueue(operation('second', '#222'));
        finishFirst?.('first');
        await Promise.resolve();
        await vi.runAllTimersAsync();

        expect(send).toHaveBeenCalledTimes(2);
        expect(confirmed).toEqual(['first', 'second']);
    });

    it('starts the first save after the 400 ms trailing coalescing window', async () => {
        const send = vi.fn<(item: Operation) => Promise<string>>().mockResolvedValue('saved');
        const queue = new TokenAutosaveQueue<Operation, string>({
            send,
            confirmed: () => undefined,
            retryable: () => false,
            statusChanged: () => undefined,
        });

        queue.enqueue(operation('first', '#111'));
        await vi.advanceTimersByTimeAsync(399);
        expect(send).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('coalesces rapid input into the last value after 400 ms of silence', async () => {
        const send = vi.fn<(item: Operation) => Promise<string>>().mockResolvedValue('saved');
        const queue = new TokenAutosaveQueue<Operation, string>({
            send,
            confirmed: () => undefined,
            retryable: () => false,
            statusChanged: () => undefined,
        });

        queue.enqueue(operation('first', '1'));
        await vi.advanceTimersByTimeAsync(250);
        queue.enqueue(operation('second', '16'));
        await vi.advanceTimersByTimeAsync(399);
        expect(send).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(send).toHaveBeenCalledOnce();
        expect(send.mock.calls[0][0].value).toBe('16');
    });

    it('waits for the remaining trailing window after an in-flight save completes', async () => {
        let finishFirst: ((value: string) => void) | undefined;
        const send = vi
            .fn<(item: Operation) => Promise<string>>()
            .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
            .mockResolvedValueOnce('second');
        const queue = new TokenAutosaveQueue<Operation, string>({
            send,
            confirmed: () => undefined,
            retryable: () => false,
            statusChanged: () => undefined,
        });

        queue.enqueue(operation('first', '#111'), true);
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(100);
        queue.enqueue(operation('second', '#222'));
        await vi.advanceTimersByTimeAsync(100);

        finishFirst?.('first');
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(299);
        expect(send).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(send.mock.calls.map(([item]) => item.generation)).toEqual(['first', 'second']);
    });

    it('keeps a temporary failure and retries it with backoff', async () => {
        const send = vi.fn<(item: Operation) => Promise<string>>().mockRejectedValueOnce(new Error('offline'));
        send.mockResolvedValueOnce('ok');
        const statuses: AutosaveStatus[] = [];
        const queue = new TokenAutosaveQueue<Operation, string>({
            send,
            confirmed: () => undefined,
            retryable: () => true,
            statusChanged: (status) => statuses.push(status),
            retryBaseMs: 100,
        });

        queue.enqueue(operation('first', '#111'), true);
        await vi.runAllTimersAsync();

        expect(send).toHaveBeenCalledTimes(2);
        expect(statuses).toContain('pending');
        expect(statuses.at(-1)).toBe('saved');
    });

    it('finishes retrying an older operation before sending its newer replacement', async () => {
        let rejectFirst: ((reason: Error) => void) | undefined;
        const send = vi
            .fn<(item: Operation) => Promise<string>>()
            .mockImplementationOnce(() => new Promise((_, reject) => (rejectFirst = reject)))
            .mockResolvedValueOnce('first-retry')
            .mockResolvedValueOnce('second');
        const confirmed: string[] = [];
        const queue = new TokenAutosaveQueue<Operation, string>({
            send,
            confirmed: (item) => confirmed.push(item.generation),
            retryable: () => true,
            statusChanged: () => undefined,
            retryBaseMs: 100,
        });

        queue.enqueue(operation('first', '#111'), true);
        await vi.advanceTimersByTimeAsync(0);
        queue.enqueue(operation('second', '#222'), true);
        rejectFirst?.(new Error('offline'));
        await vi.runAllTimersAsync();

        expect(send.mock.calls.map(([item]) => item.generation)).toEqual(['first', 'first', 'second']);
        expect(confirmed).toEqual(['first', 'second']);
    });

    it('exposes a permanent failure for a manual retry', async () => {
        const send = vi.fn<(item: Operation) => Promise<string>>().mockRejectedValueOnce(new Error('invalid'));
        send.mockResolvedValueOnce('ok');
        const statuses: AutosaveStatus[] = [];
        const queue = new TokenAutosaveQueue<Operation, string>({
            send,
            confirmed: () => undefined,
            retryable: () => false,
            statusChanged: (status) => statuses.push(status),
        });

        queue.enqueue(operation('first', '#111'), true);
        await vi.runAllTimersAsync();
        expect(statuses.at(-1)).toBe('error');

        queue.retryFailed();
        await vi.runAllTimersAsync();
        expect(send).toHaveBeenCalledTimes(2);
        expect(statuses.at(-1)).toBe('saved');
    });
});
