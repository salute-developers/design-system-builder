import { useCallback, useEffect, useRef, useState } from 'react';

import {
    AiChatError,
    type AiChatEvent,
    type AiChatMessage,
    type AiChatStatus,
    type AiScreenContext,
    getAiChatStatus,
    startAiTurn,
    stopAiTurn,
    streamAiTurn,
} from '../../api/aiChat';
import { authService } from '../../api/authService';
import { rejectionText, toolLabel, toolErrorText, turnErrorText } from './aiChatTexts';

/** Строка ленты панели. */
export type AiChatItem =
    | { kind: 'user'; id: string; text: string }
    | { kind: 'assistant'; id: string; text: string }
    | { kind: 'step'; id: string; label: string; state: 'running' | 'done' | 'failed'; detail?: string }
    | { kind: 'notice'; id: string; text: string; tone: 'info' | 'error' };

/** Операция, ожидающая решения пользователя. */
export interface PendingConfirmation {
    callId: string;
    tool: string;
    reason: 'destructive' | 'write_limit';
    confirmationToken: string;
    arguments: Record<string, unknown>;
}

interface Options {
    projectId: string;
    designSystemId: string;
    /** Текущий контекст экрана; читается в момент отправки. */
    getContext?: () => AiScreenContext | undefined;
    /** Подменяется в тестах. */
    newKey?: () => string;
}

const INTERRUPTED: AiChatMessage = { role: 'interrupted' };

/** Ход другой вкладки: его проект нужен, чтобы остановить ход из другого проекта. */
interface ForeignTurn {
    turnId: string;
    projectId: string;
}

/** Исход запуска хода: принят, отклонён со статусом или неизвестен (сеть не ответила). */
type StartOutcome =
    | { kind: 'accepted' }
    | { kind: 'rejected'; error: AiChatError }
    | { kind: 'unknown' }
    /** Пока шёл запрос, разговор сбросили или сменили DS: результат к текущему разговору не относится. */
    | { kind: 'stale' };

/** Отказы, после которых решение по подтверждению можно повторить тем же токеном. */
const isTemporary = (error: AiChatError) =>
    error.status === 0 || error.status === 413 || error.status === 429 || error.status === 503;

/**
 * Состояние чата: история только в памяти вкладки, ход в фоне на сервере, восстановление потока и пометка
 * `interrupted`, если связь с ходом потеряна безвозвратно.
 */
export const useAiChat = ({ projectId, designSystemId, getContext, newKey = () => crypto.randomUUID() }: Options) => {
    const [status, setStatus] = useState<AiChatStatus | null>(null);
    const [items, setItems] = useState<AiChatItem[]>([]);
    const [pending, setPending] = useState<PendingConfirmation | null>(null);
    const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
    const [foreignTurn, setForeignTurn] = useState<ForeignTurn | null>(null);
    const [starting, setStarting] = useState(false);
    /** Поколение разговора: растёт при сбросе и размонтировании, отбрасывает ответы прежнего разговора. */
    const generation = useRef(0);
    const history = useRef<AiChatMessage[]>([]);
    /** Размер истории в символах JSON: по нему панель предупреждает о длинном разговоре. */
    const [historyChars, setHistoryChars] = useState(0);
    const setHistory = useCallback((messages: AiChatMessage[]) => {
        history.current = messages;
        setHistoryChars(messages.length ? JSON.stringify(messages).length : 0);
    }, []);
    const abort = useRef<AbortController | null>(null);
    const counter = useRef(0);

    const add = useCallback((item: AiChatItem) => setItems((current) => [...current, item]), []);
    const notice = useCallback(
        (text: string, tone: 'info' | 'error' = 'error') =>
            add({ kind: 'notice', id: `item-${++counter.current}`, text, tone }),
        [add],
    );

    useEffect(() => {
        let cancelled = false;
        getAiChatStatus(projectId)
            .then((value) => !cancelled && setStatus(value))
            .catch(() => !cancelled && setStatus({ enabled: false }));
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    const markInterrupted = useCallback(() => {
        if (history.current[history.current.length - 1]?.role !== 'interrupted')
            setHistory([...history.current, INTERRUPTED]);
        notice('Связь с ходом потеряна, исход изменений неизвестен. Проверьте изменения в редакторе.');
    }, [notice, setHistory]);

    const handleEvent = useCallback(
        (event: AiChatEvent, attached: boolean) => {
            switch (event.type) {
                case 'tool_started':
                    add({ kind: 'step', id: event.callId, label: toolLabel(event.tool), state: 'running' });
                    break;
                case 'tool_result':
                    setItems((current) => {
                        const step: AiChatItem = {
                            kind: 'step',
                            id: event.callId,
                            label: toolLabel(event.tool),
                            state: event.isError ? 'failed' : 'done',
                            detail: event.isError ? toolErrorText(event.code, event.backendCode) : undefined,
                        };
                        const index = current.findIndex((item) => item.kind === 'step' && item.id === event.callId);
                        if (index < 0) return [...current, step];
                        return current.map((item, position) => (position === index ? step : item));
                    });
                    break;
                case 'confirmation_required':
                    // Решение по ходу другой вкладки принимается там: только у неё история с этим вызовом.
                    if (attached) {
                        notice('Ассистент ждёт подтверждения операции во вкладке, где начат разговор.', 'info');
                        break;
                    }
                    setPending({
                        callId: event.callId,
                        tool: event.tool,
                        reason: event.reason,
                        confirmationToken: event.confirmationToken,
                        arguments: event.arguments,
                    });
                    break;
                case 'message':
                    add({ kind: 'assistant', id: `item-${++counter.current}`, text: event.text });
                    break;
                case 'state':
                    // Ход другой вкладки не заменяет историю этой вкладки.
                    if (!attached) setHistory(event.messages);
                    break;
                case 'error':
                    notice(turnErrorText(event.code, event.message));
                    break;
                case 'done':
                    break;
            }
        },
        [add, notice, setHistory],
    );

    const follow = useCallback(
        async (turnId: string, attached: boolean, from: number) => {
            if (from !== generation.current) return;
            abort.current?.abort();
            const controller = new AbortController();
            abort.current = controller;
            setActiveTurnId(turnId);
            try {
                await streamAiTurn({
                    projectId,
                    turnId,
                    signal: controller.signal,
                    received: (event) => handleEvent(event, attached),
                });
            } catch {
                if (!controller.signal.aborted && !attached) markInterrupted();
            } finally {
                if (abort.current === controller) {
                    abort.current = null;
                    setActiveTurnId(null);
                }
            }
        },
        [handleEvent, markInterrupted, projectId],
    );

    const start = useCallback(
        async (
            messages: AiChatMessage[],
            confirmations: { confirmationToken: string; approved: boolean }[] = [],
            userText?: string,
        ): Promise<StartOutcome> => {
            const shown = () => {
                if (userText !== undefined) add({ kind: 'user', id: `item-${++counter.current}`, text: userText });
            };
            const from = generation.current;
            const stale = () => from !== generation.current;
            let turnId: string;
            setStarting(true);
            try {
                turnId = await startAiTurn({
                    projectId,
                    designSystemId,
                    messages,
                    confirmations,
                    idempotencyKey: newKey(),
                    context: getContext?.(),
                });
            } catch (error) {
                if (stale()) return { kind: 'stale' };
                setStarting(false);
                const failure = error instanceof AiChatError ? error : new AiChatError(0, 'unknown');
                if (failure.code === 'network_error') {
                    // Ход мог быть принят: сообщение остаётся в истории, исход помечаем неизвестным.
                    shown();
                    setHistory(messages);
                    markInterrupted();
                    return { kind: 'unknown' };
                }
                if (failure.code === 'ai_busy') {
                    const active = failure.details.activeTurnId;
                    const busyProject = failure.details.projectId ?? projectId;
                    if (failure.details.designSystemId === designSystemId && busyProject === projectId && active) {
                        notice('Предыдущий запрос ещё выполняется, показываем его ход.', 'info');
                        void follow(active, true, from);
                    } else {
                        setForeignTurn(active ? { turnId: active, projectId: busyProject } : null);
                        notice('Идёт запрос в другой вкладке.', 'info');
                    }
                } else {
                    notice(rejectionText(failure.status, failure.code, failure.retryAfterSeconds));
                }
                return { kind: 'rejected', error: failure };
            }
            if (stale()) return { kind: 'stale' };
            setStarting(false);
            shown();
            setHistory(messages);
            setForeignTurn(null);
            // Новое сообщение закрывает предложенную операцию: сервер добавит ей результат not_confirmed.
            setPending(null);
            await follow(turnId, false, from);
            return { kind: 'accepted' };
        },
        [add, designSystemId, follow, getContext, markInterrupted, newKey, notice, projectId, setHistory],
    );

    /** Отправляет сообщение; false — сообщение не принято и остаётся в поле ввода. */
    const send = useCallback(
        async (text: string) => {
            const message: AiChatMessage = { role: 'user', text };
            const outcome = await start([...history.current, message], [], text);
            return outcome.kind !== 'rejected';
        },
        [start],
    );

    const decide = useCallback(
        async (approved: boolean) => {
            const confirmation = pending;
            if (!confirmation) return;
            setPending(null);
            const outcome = await start(history.current, [
                { confirmationToken: confirmation.confirmationToken, approved },
            ]);
            // Временный отказ или неизвестный исход: решение можно повторить тем же токеном, сервер вернёт тот же ход.
            if (outcome.kind === 'unknown' || (outcome.kind === 'rejected' && isTemporary(outcome.error)))
                setPending(confirmation);
        },
        [pending, start],
    );

    const stop = useCallback(async () => {
        if (activeTurnId) await stopAiTurn(projectId, activeTurnId).catch(() => undefined);
        else if (foreignTurn) await stopAiTurn(foreignTurn.projectId, foreignTurn.turnId).catch(() => undefined);
        setForeignTurn(null);
    }, [activeTurnId, foreignTurn, projectId]);

    const reset = useCallback(() => {
        generation.current++;
        setStarting(false);
        abort.current?.abort();
        setHistory([]);
        setItems([]);
        setPending(null);
        setForeignTurn(null);
    }, [setHistory]);

    // Разговор принадлежит дизайн-системе: при переходе в другую DS или проект начинается новый.
    const scope = `${projectId}:${designSystemId}`;
    const previousScope = useRef(scope);
    useEffect(() => {
        if (previousScope.current === scope) return;
        previousScope.current = scope;
        reset();
    }, [reset, scope]);

    // При выходе останавливаем ход, пока токен ещё действителен.
    useEffect(() => {
        const unsubscribe = authService.onBeforeLogout(async () => {
            if (activeTurnId) await stopAiTurn(projectId, activeTurnId).catch(() => undefined);
        });
        return () => {
            unsubscribe();
        };
    }, [activeTurnId, projectId]);

    useEffect(
        () => () => {
            generation.current++;
            abort.current?.abort();
        },
        [],
    );

    return {
        status,
        items,
        pending,
        /** Идёт запуск или ход: отправка и «Новый чат» недоступны. */
        running: starting || activeTurnId !== null,
        foreignTurn: foreignTurn !== null,
        historySnapshot: () => history.current,
        historyChars,
        send,
        decide,
        stop,
        reset,
    };
};
