import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiChatError, parseAiEventStream, sanitizeScreenContext, startAiTurn, streamAiTurn } from './aiChat';
import type { AiChatEvent } from './aiChat';
import { authService } from './authService';

const encoder = new TextEncoder();
const sse = (...chunks: string[]) =>
    new ReadableStream<Uint8Array>({
        start(controller) {
            chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
            controller.close();
        },
    });

const block = (id: number, type: string, data: object = {}) =>
    `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

describe('ai chat api', () => {
    beforeEach(() => {
        vi.spyOn(authService, 'getValidAccessToken').mockResolvedValue('token');
        vi.spyOn(authService, 'refreshAccessToken').mockResolvedValue('token');
    });
    afterEach(() => vi.restoreAllMocks());

    it('parses events split between chunks and skips heartbeats', async () => {
        const stream = sse(': heartbeat\n\nid: 1\nevent: mess', 'age\ndata: {"text":"Привет"}\n\n', block(2, 'done'));
        const events = [];
        for await (const event of parseAiEventStream(stream)) events.push(event);

        expect(events).toEqual([
            { id: 1, event: { type: 'message', text: 'Привет' } },
            { id: 2, event: { type: 'done' } },
        ]);
    });

    it('reconnects with the cursor and does not repeat events', async () => {
        const urls: string[] = [];
        const responses = [
            new Response(sse(block(1, 'tool_started', { callId: 'c1', tool: 't', arguments: {} }))),
            new Response(sse(block(1, 'tool_started'), block(2, 'message', { text: 'ok' }), block(3, 'done'))),
        ];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                urls.push(url);
                return responses.shift()!;
            }),
        );
        const received: [number, AiChatEvent['type']][] = [];
        await streamAiTurn({
            projectId: 'p',
            turnId: 't1',
            signal: new AbortController().signal,
            received: (event, id) => received.push([id, event.type]),
            reconnectDelayMillis: 0,
        });

        expect(received).toEqual([
            [1, 'tool_started'],
            [2, 'message'],
            [3, 'done'],
        ]);
        expect(urls[1]).toContain('after=1');
    });

    it('retries too_many_streams with a delay and then gives up', async () => {
        const fetchMock = vi.fn(
            async () => new Response(JSON.stringify({ code: 'too_many_streams' }), { status: 429 }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            streamAiTurn({
                projectId: 'p',
                turnId: 't1',
                signal: new AbortController().signal,
                received: () => {},
                tooManyStreamsDelayMillis: 0,
            }),
        ).rejects.toMatchObject({ code: 'too_many_streams' });
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('reports turn_unknown on 404', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify({ code: 'turn_unknown' }), { status: 404 })),
        );

        await expect(
            streamAiTurn({ projectId: 'p', turnId: 't1', signal: new AbortController().signal, received: () => {} }),
        ).rejects.toMatchObject({ status: 404, code: 'turn_unknown' });
    });

    it('repeats POST with the same key after a network error', async () => {
        const keys: string[] = [];
        let calls = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_: string, init: RequestInit) => {
                keys.push((init.headers as Record<string, string>)['Idempotency-Key']);
                if (calls++ === 0) throw new TypeError('network');
                return new Response(JSON.stringify({ turnId: 'turn-1' }), { status: 202 });
            }),
        );

        const turnId = await startAiTurn({
            projectId: 'p',
            designSystemId: 'ds',
            messages: [{ role: 'user', text: 'x' }],
            idempotencyKey: 'key-1',
            retryDelayMillis: 0,
        });

        expect(turnId).toBe('turn-1');
        expect(keys).toEqual(['key-1', 'key-1']);
    });

    const UUID_1 = '11111111-1111-4111-8111-111111111111';

    it('repeats POST with the same key after 401 and a refreshed token', async () => {
        const keys: string[] = [];
        const responses = [
            new Response('', { status: 401 }),
            new Response(JSON.stringify({ turnId: 't' }), { status: 202 }),
        ];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_: string, init: RequestInit) => {
                keys.push((init.headers as Record<string, string>)['Idempotency-Key']);
                return responses.shift()!;
            }),
        );

        const turnId = await startAiTurn({ projectId: 'p', designSystemId: 'ds', messages: [], idempotencyKey: 'k' });

        expect(turnId).toBe('t');
        expect(keys).toEqual(['k', 'k']);
        expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it('reads retryAfterSeconds from the body, then from Retry-After, and survives an empty 413', async () => {
        const responses = [
            new Response(JSON.stringify({ code: 'ai_turn_limit', retryAfterSeconds: 61 }), { status: 429 }),
            new Response(JSON.stringify({ code: 'ai_turn_limit' }), { status: 429, headers: { 'Retry-After': '30' } }),
            new Response('', { status: 413 }),
        ];
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => responses.shift()!),
        );
        const run = () =>
            startAiTurn({ projectId: 'p', designSystemId: 'ds', messages: [], idempotencyKey: 'k' }).catch(
                (error: AiChatError) => error,
            );

        expect(await run()).toMatchObject({ status: 429, code: 'ai_turn_limit', retryAfterSeconds: 61 });
        expect(await run()).toMatchObject({ retryAfterSeconds: 30 });
        expect(await run()).toMatchObject({ status: 413, code: 'http_413' });
    });

    it('drops identifiers that are not UUID and extra variation values from the context', () => {
        const values = Array.from({ length: 25 }, (_, index) => ({ styleId: UUID_1, value: `v${index}` }));
        const context = sanitizeScreenContext({
            section: 'components',
            tenantId: 'not-a-uuid',
            token: { id: 'tok', name: 'x' },
            component: {
                name: 'Button',
                id: UUID_1,
                appearanceId: 'a1',
                selectedValues: [{ styleId: 's1' }, ...values],
            },
        });

        expect(context.tenantId).toBeUndefined();
        expect(context.token).toBeUndefined();
        expect(context.component?.id).toBe(UUID_1);
        expect(context.component?.appearanceId).toBeUndefined();
        expect(context.component?.selectedValues).toHaveLength(20);
    });

    it('reports a missing token as unauthorized, not as a network error', async () => {
        vi.mocked(authService.getValidAccessToken).mockResolvedValue(null);
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);

        await expect(
            startAiTurn({
                projectId: 'p',
                designSystemId: 'ds',
                messages: [],
                idempotencyKey: 'k',
                retryDelayMillis: 0,
            }),
        ).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('refreshes the token once per failure in the stream and then gives up', async () => {
        const fetch = vi.fn(async () => new Response('', { status: 401 }));
        vi.stubGlobal('fetch', fetch);

        await expect(
            streamAiTurn({ projectId: 'p', turnId: 't1', signal: new AbortController().signal, received: () => {} }),
        ).rejects.toMatchObject({ status: 401 });
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it('ends reading on 403 and 503 so the turn is marked interrupted', async () => {
        for (const status of [403, 503]) {
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => new Response('{}', { status })),
            );
            await expect(
                streamAiTurn({
                    projectId: 'p',
                    turnId: 't1',
                    signal: new AbortController().signal,
                    received: () => {},
                }),
            ).rejects.toMatchObject({ status });
        }
    });
});
