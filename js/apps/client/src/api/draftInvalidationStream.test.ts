import { describe, expect, it } from 'vitest';

import { parseDraftEventStream } from './draftInvalidationStream';

describe('draft invalidation stream', () => {
    it('does not order UUID markers and accepts a full reconciliation cursor', async () => {
        const encoder = new TextEncoder();
        const payloads = [
            { eventId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', scopes: ['theme-tokens'] },
            { eventId: '00000000-0000-0000-0000-000000000001', scopes: ['theme-metadata'] },
            { eventId: '00000000-0000-0000-0000-000000000002', draftRevision: 9, scopes: ['all'] },
        ];
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                payloads.forEach((payload, index) =>
                    controller.enqueue(
                        encoder.encode(
                            `event: ${index === 2 ? 'draft-reconciled' : 'draft-invalidated'}\ndata: ${JSON.stringify({
                                designSystemId: 'ds-1',
                                draftId: 'draft-1',
                                actorId: 'user-1',
                                changedAt: '2026-10-21T09:00:00Z',
                                ...payload,
                            })}\n\n`,
                        ),
                    ),
                );
                controller.close();
            },
        });
        const events = [];
        for await (const event of parseDraftEventStream(stream)) events.push(event);
        expect(events.map(({ eventId }) => eventId)).toEqual(payloads.map(({ eventId }) => eventId));
        expect(events.map(({ draftRevision }) => draftRevision)).toEqual([undefined, undefined, 9]);
    });

    it('parses an SSE event split across network chunks and ignores heartbeats', async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode(': heartbeat\n\nevent: draft-invalidated\nid: draft-1:'));
                controller.enqueue(
                    encoder.encode(
                        '2\ndata: {"designSystemId":"ds-1","draftId":"draft-1","draftRevision":2,' +
                            '"actorId":"user-1","clientId":"tab-2","changedAt":"2026-10-15T13:30:00Z",' +
                            '"scopes":["theme-tokens"]}\n\n',
                    ),
                );
                controller.close();
            },
        });

        const events = [];
        for await (const event of parseDraftEventStream(stream)) events.push(event);

        expect(events).toEqual([
            {
                designSystemId: 'ds-1',
                draftId: 'draft-1',
                draftRevision: 2,
                actorId: 'user-1',
                clientId: 'tab-2',
                changedAt: '2026-10-15T13:30:00Z',
                scopes: ['theme-tokens'],
            },
        ]);
    });

    it('uses a full refresh for an older event without scopes', async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(
                    encoder.encode(
                        'event: draft-invalidated\n' +
                            'data: {"designSystemId":"ds-1","draftId":"draft-1","draftRevision":3,' +
                            '"actorId":"system","clientId":null,"changedAt":"2026-10-15T13:31:00Z"}\n\n',
                    ),
                );
                controller.close();
            },
        });

        const events = [];
        for await (const event of parseDraftEventStream(stream)) events.push(event);

        expect(events[0].scopes).toEqual(['all']);
    });

    it('uses a full refresh when an event contains an unknown scope', async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(
                    encoder.encode(
                        'event: draft-invalidated\n' +
                            'data: {"designSystemId":"ds-1","draftId":"draft-1","draftRevision":4,' +
                            '"actorId":"system","clientId":null,"changedAt":"2026-10-15T13:32:00Z",' +
                            '"scopes":["theme-tokens","palette"]}\n\n',
                    ),
                );
                controller.close();
            },
        });

        const events = [];
        for await (const event of parseDraftEventStream(stream)) events.push(event);

        expect(events[0].scopes).toEqual(['all']);
    });
});
