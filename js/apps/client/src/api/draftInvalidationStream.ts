import { authService } from './authService';
import { getEditorClientId } from './editorClientIdentity';
import { PROJECTS_URL } from './constants';
import type { EditorContextKey } from './editorContracts';

export type DraftInvalidationScope =
    | 'theme-tokens'
    | 'theme-metadata'
    | 'component-configurations'
    | 'design-system'
    | 'all';

export interface DraftInvalidationEvent {
    designSystemId: string;
    draftId: string;
    draftRevision: number;
    actorId: string;
    clientId: string | null;
    changedAt: string;
    scopes: DraftInvalidationScope[];
}

interface DraftInvalidationSubscription {
    context: EditorContextKey;
    draftId: string;
    draftRevision: number;
    signal: AbortSignal;
    received: (event: DraftInvalidationEvent) => void;
}

/** Поддерживает авторизованное SSE-соединение и восстанавливает его до отмены владельцем редактора. */
export const subscribeToDraftInvalidations = async ({
    context,
    draftId,
    draftRevision,
    signal,
    received,
}: DraftInvalidationSubscription) => {
    let knownDraftId = draftId;
    let knownDraftRevision = draftRevision;
    while (!signal.aborted) {
        try {
            const token = await authService.getValidAccessToken();
            if (!token) return;
            const query = new URLSearchParams({
                draftId: knownDraftId,
                draftRevision: String(knownDraftRevision),
            });
            const response = await fetch(
                `${PROJECTS_URL}/${context.projectId}/ds/design-systems/${context.designSystemId}/events?${query}`,
                {
                    headers: {
                        Accept: 'text/event-stream',
                        Authorization: `Bearer ${token}`,
                        'X-DS-Client-Id': getEditorClientId(),
                    },
                    signal,
                },
            );
            if (response.status === 401) {
                await authService.refreshAccessToken();
                continue;
            }
            if (!response.ok || !response.body) throw new Error(`draft event stream failed: ${response.status}`);
            for await (const event of parseDraftEventStream(response.body, signal)) {
                knownDraftId = event.draftId;
                knownDraftRevision = event.draftRevision;
                received(event);
            }
            if (!signal.aborted) await abortableDelay(RECONNECT_DELAY_MILLIS, signal);
        } catch {
            if (signal.aborted) return;
            await abortableDelay(RECONNECT_DELAY_MILLIS, signal);
        }
    }
};

export async function* parseDraftEventStream(
    stream: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
): AsyncGenerator<DraftInvalidationEvent> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (!signal?.aborted) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
            let boundary = buffer.indexOf('\n\n');
            while (boundary >= 0) {
                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const event = parseEventBlock(block);
                if (event) yield event;
                boundary = buffer.indexOf('\n\n');
            }
        }
    } finally {
        reader.releaseLock();
    }
}

const parseEventBlock = (block: string): DraftInvalidationEvent | null => {
    const lines = block.split('\n');
    if (!lines.some((line) => line === 'event: draft-invalidated')) return null;
    const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
    if (!data) return null;
    try {
        const value = JSON.parse(data) as Partial<DraftInvalidationEvent>;
        if (
            typeof value.designSystemId !== 'string' ||
            typeof value.draftId !== 'string' ||
            typeof value.draftRevision !== 'number' ||
            typeof value.actorId !== 'string' ||
            typeof value.changedAt !== 'string'
        ) {
            return null;
        }
        const wireScopes = Array.isArray(value.scopes) ? value.scopes : [];
        const scopes = wireScopes.filter(
            (scope): scope is DraftInvalidationScope => invalidationScopes.has(scope),
        );
        return {
            ...value,
            clientId: typeof value.clientId === 'string' ? value.clientId : null,
            scopes: scopes.length && scopes.length === wireScopes.length ? [...new Set(scopes)] : ['all'],
        } as DraftInvalidationEvent;
    } catch {
        return null;
    }
};

const abortableDelay = (timeout: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        const timer = window.setTimeout(resolve, timeout);
        signal.addEventListener(
            'abort',
            () => {
                window.clearTimeout(timer);
                resolve();
            },
            { once: true },
        );
    });

const RECONNECT_DELAY_MILLIS = 2_000;
const invalidationScopes = new Set<unknown>([
    'theme-tokens',
    'theme-metadata',
    'component-configurations',
    'design-system',
    'all',
]);
