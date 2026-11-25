import { authService } from './authService';
import { PROJECTS_URL } from './constants';

/** Реплика разговора в формате API чата. */
export interface AiChatMessage {
    role: 'user' | 'assistant' | 'tool' | 'interrupted';
    text?: string;
    toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
    toolResult?: {
        callId: string;
        name: string;
        content: string;
        isError: boolean;
        code?: string;
        backendCode?: string;
    };
}

export interface AiChatStatus {
    enabled: boolean;
    provider?: string;
    model?: string;
    messageMaxChars?: number;
    /** Предел истории разговора в символах; по нему панель заранее предупреждает о длинном разговоре. */
    historyMaxChars?: number;
}

export type AiChatEvent =
    | { type: 'tool_started'; callId: string; tool: string; arguments: Record<string, unknown> }
    | {
          type: 'tool_result';
          callId: string;
          tool: string;
          isError: boolean;
          code?: string | null;
          backendCode?: string | null;
          summary: string;
      }
    | {
          type: 'confirmation_required';
          callId: string;
          tool: string;
          arguments: Record<string, unknown>;
          reason: 'destructive' | 'write_limit';
          confirmationToken: string;
          expiresAt: string;
      }
    | { type: 'message'; text: string }
    | { type: 'state'; messages: AiChatMessage[] }
    | { type: 'error'; code: string; message: string }
    | { type: 'done' };

/** Ошибка API чата с машиночитаемым кодом. */
export class AiChatError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: Record<string, string>;
    /** Через сколько секунд повторить запрос, если отказ временный. */
    readonly retryAfterSeconds?: number;

    constructor(status: number, code: string, details: Record<string, string> = {}, retryAfterSeconds?: number) {
        super(code);
        this.status = status;
        this.code = code;
        this.details = details;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

const aiUrl = (projectId: string, path: string) => `${PROJECTS_URL}/${encodeURIComponent(projectId)}/ai${path}`;

/** Токен доступа; его отсутствие или неудачное обновление — отказ `unauthorized`, а не сетевая ошибка. */
const accessToken = async (refresh = false) => {
    const token = await (refresh ? authService.refreshAccessToken() : authService.getValidAccessToken()).catch(
        () => null,
    );
    if (!token) throw new AiChatError(401, 'unauthorized');
    return token;
};

const authorizedFetch = async (url: string, init: RequestInit = {}) => {
    const token = await accessToken();
    return fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
};

const failure = async (response: Response): Promise<AiChatError> => {
    // Тело может быть пустым или не JSON: например, 413 от шлюза или монолита.
    const body = await response.json().catch(() => ({}));
    const { code, retryAfterSeconds, ...rest } = (body && typeof body === 'object' ? body : {}) as Record<
        string,
        unknown
    >;
    const details = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, String(value)]));
    const header = Number(response.headers.get('Retry-After'));
    const retryAfter =
        typeof retryAfterSeconds === 'number'
            ? retryAfterSeconds
            : Number.isFinite(header) && header > 0
              ? header
              : undefined;
    return new AiChatError(
        response.status,
        typeof code === 'string' ? code : `http_${response.status}`,
        details,
        retryAfter,
    );
};

export const getAiChatStatus = async (projectId: string): Promise<AiChatStatus> => {
    const response = await authorizedFetch(aiUrl(projectId, '/status'));
    if (!response.ok) return { enabled: false };
    return (await response.json()) as AiChatStatus;
};

/** Что открыто в редакторе: подсказка модели, а не право; в историю не попадает. */
export interface AiScreenContext {
    section: 'colors' | 'typography' | 'shapes' | 'palette' | 'components' | 'other';
    tenantId?: string;
    token?: { id: string; name?: string };
    component?: {
        name?: string;
        id?: string;
        appearanceId?: string;
        selectedValues?: { variation?: string; value?: string; styleId: string }[];
    };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Больше значений вариаций сервер не принимает. */
const MAX_SELECTED_VALUES = 20;
const uuidOrUndefined = (value?: string) => (value && UUID.test(value) ? value : undefined);

/**
 * Убирает из контекста то, из-за чего сервер отклонил бы весь ход: идентификаторы не UUID
 * и лишние значения вариаций. Контекст — подсказка, поэтому лучше передать его частично.
 */
export const sanitizeScreenContext = (context: AiScreenContext): AiScreenContext => {
    // Без корректного id сервер отклоняет токен в контексте целиком, поэтому такой токен не передаём.
    const token = context.token && uuidOrUndefined(context.token.id) ? context.token : undefined;
    const component = context.component && {
        ...context.component,
        id: uuidOrUndefined(context.component.id),
        appearanceId: uuidOrUndefined(context.component.appearanceId),
        selectedValues: context.component.selectedValues
            ?.filter((value) => UUID.test(value.styleId))
            .slice(0, MAX_SELECTED_VALUES),
    };
    return JSON.parse(
        JSON.stringify({ ...context, tenantId: uuidOrUndefined(context.tenantId), token, component }),
    ) as AiScreenContext;
};

interface StartTurn {
    projectId: string;
    designSystemId: string;
    messages: AiChatMessage[];
    confirmations?: { confirmationToken: string; approved: boolean }[];
    idempotencyKey: string;
    context?: AiScreenContext;
    attempts?: number;
    retryDelayMillis?: number;
}

/**
 * Запускает ход. Сетевая ошибка — до [attempts] попыток с тем же ключом: сервер вернёт тот же ход.
 * 401 — одно обновление токена и повтор с тем же ключом.
 */
export const startAiTurn = async ({
    projectId,
    designSystemId,
    messages,
    confirmations = [],
    idempotencyKey,
    context,
    attempts = 3,
    retryDelayMillis = 1000,
}: StartTurn): Promise<string> => {
    const body = JSON.stringify({
        designSystemId,
        messages,
        confirmations,
        ...(context ? { context: sanitizeScreenContext(context) } : {}),
    });
    let lastError: unknown = null;
    let refreshed = false;
    for (let attempt = 0; attempt < attempts; attempt++) {
        let response: Response;
        try {
            response = await authorizedFetch(aiUrl(projectId, '/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
                body,
            });
        } catch (error) {
            if (error instanceof AiChatError) throw error;
            lastError = error;
            if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, retryDelayMillis));
            continue;
        }
        if (response.status === 202) return ((await response.json()) as { turnId: string }).turnId;
        // Отклонённый запрос хода не регистрирует: после обновления токена повторяем с тем же ключом.
        if (response.status === 401 && !refreshed) {
            refreshed = true;
            await accessToken(true);
            attempt--;
            continue;
        }
        throw await failure(response);
    }
    throw new AiChatError(0, 'network_error', { cause: String(lastError) });
};

/** Останавливает ход; [projectId] — проект хода, он может отличаться от открытого. */
export const stopAiTurn = async (projectId: string, turnId: string) => {
    await authorizedFetch(aiUrl(projectId, `/turns/${encodeURIComponent(turnId)}`), { method: 'DELETE' });
};

interface StreamTurn {
    projectId: string;
    turnId: string;
    signal: AbortSignal;
    received: (event: AiChatEvent, id: number) => void;
    /** Номер последнего полученного события; события с номером не больше него не повторяются. */
    after?: number;
    tooManyStreamsDelayMillis?: number;
    reconnectDelayMillis?: number;
}

/**
 * Читает события хода до `done`, переподключаясь с курсором `after` после обрыва.
 * 401 — обновить токен и переподключиться; 429 too_many_streams — до трёх повторов с задержкой;
 * 404 turn_unknown — ход потерян, вызывающий помечает его прерванным.
 */
export const streamAiTurn = async ({
    projectId,
    turnId,
    signal,
    received,
    after = 0,
    tooManyStreamsDelayMillis = 15_000,
    reconnectDelayMillis = 1_000,
}: StreamTurn): Promise<void> => {
    let cursor = after;
    let busyRetries = 0;
    let refreshedAfterFailure = false;
    let failures = 0;
    while (!signal.aborted) {
        let response: Response;
        try {
            const query = cursor > 0 ? `?after=${cursor}` : '';
            response = await authorizedFetch(aiUrl(projectId, `/turns/${encodeURIComponent(turnId)}/events${query}`), {
                headers: { Accept: 'text/event-stream' },
                signal,
            });
        } catch (error) {
            if (signal.aborted) return;
            if (error instanceof AiChatError) throw error;
            if (++failures > MAX_RECONNECTS) throw new AiChatError(0, 'connection_lost', { cause: String(error) });
            await abortableDelay(reconnectDelayMillis, signal);
            continue;
        }
        // Одно обновление токена подряд: повторный 401 после него — отказ, а не бесконечный цикл.
        if (response.status === 401 && !refreshedAfterFailure) {
            refreshedAfterFailure = true;
            await accessToken(true);
            continue;
        }
        if (response.status === 429) {
            if (++busyRetries > MAX_BUSY_RETRIES) throw await failure(response);
            await abortableDelay(tooManyStreamsDelayMillis, signal);
            continue;
        }
        if (!response.ok || !response.body) throw await failure(response);
        busyRetries = 0;
        refreshedAfterFailure = false;
        try {
            for await (const { id, event } of parseAiEventStream(response.body, signal)) {
                if (id <= cursor) continue;
                cursor = id;
                failures = 0;
                received(event, id);
                if (event.type === 'done') return;
            }
        } catch (error) {
            if (signal.aborted) return;
            if (++failures > MAX_RECONNECTS) throw new AiChatError(0, 'connection_lost', { cause: String(error) });
        }
        if (!signal.aborted) await abortableDelay(reconnectDelayMillis, signal);
    }
};

const MAX_BUSY_RETRIES = 3;
const MAX_RECONNECTS = 5;

/** Разбирает SSE: события с `id`, `event` и `data`; комментарии `: heartbeat` пропускаются. */
export async function* parseAiEventStream(
    stream: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
): AsyncGenerator<{ id: number; event: AiChatEvent }> {
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
                const parsed = parseBlock(buffer.slice(0, boundary));
                buffer = buffer.slice(boundary + 2);
                if (parsed) yield parsed;
                boundary = buffer.indexOf('\n\n');
            }
        }
    } finally {
        reader.releaseLock();
    }
}

const parseBlock = (block: string): { id: number; event: AiChatEvent } | null => {
    let id = 0;
    let type = '';
    const data: string[] = [];
    for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('id:')) id = Number(line.slice(3).trim());
        else if (line.startsWith('event:')) type = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!type || !id) return null;
    try {
        return { id, event: { type, ...JSON.parse(data.join('\n') || '{}') } as AiChatEvent };
    } catch {
        return null;
    }
};

const abortableDelay = (millis: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, millis);
        signal.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                resolve();
            },
            { once: true },
        );
    });
