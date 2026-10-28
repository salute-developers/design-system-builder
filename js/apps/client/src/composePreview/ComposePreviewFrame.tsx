import { useEffect, useMemo, useRef, useState } from 'react';

import { loadComposePreviewManifest } from './manifest';
import { ComposePreviewResultError, ComposePreviewSession, ComposePreviewTimeoutError } from './session';
import { isDebugMode } from '../utils/debugMode';

import { PreviewPayloadInput, PreviewComponentDescription, PreviewFailureDetails, PreviewPluginPlatform } from './types';
import type { LoadedComposePreviewManifest } from './types';
import { ComposeFailureDetails } from './ComposeFailureDetails';
import { FrameRoot, PreviewIframe, Status } from './ComposePreviewFrame.styles';

export interface ComposePreviewFrameProps {
    pluginUrl: string;
    /** Платформа плагина: манифест другой платформы отклоняется. По умолчанию `compose`. */
    platform?: PreviewPluginPlatform;
    /** Без payload плагин только загружается и ждёт `ready`: так хост раздела прогревает его до выбора компонента. */
    payload?: PreviewPayloadInput;
    /**
     * Чья область превью сейчас показывает кадр. При смене получателя кадр прежнего скрывается до `success`
     * нового payload, а описание компонента запрашивается заново.
     */
    subscriber?: string;
    /** Story, которую описывает `describe`; при смене описание запрашивается заново. Без него — story по умолчанию. */
    storyId?: string;
    timeoutMs?: number;
    onDescription?: (description: PreviewComponentDescription) => void;
    onDescriptionError?: (error: Error) => void;
    loadManifest?: (pluginUrl: string, platform: PreviewPluginPlatform) => Promise<LoadedComposePreviewManifest>;
    createSession?: (
        plugin: LoadedComposePreviewManifest,
        targetWindow: Window,
        timeoutMs?: number,
    ) => Pick<ComposePreviewSession, 'waitUntilReady' | 'send' | 'describeComponent' | 'reload' | 'dispose'>;
}

type FrameStatus = 'loading' | 'ready' | 'rendering' | 'success' | 'failure';

const PLUGIN_CRASH_CODES = ['render_crashed', 'plugin_crashed'];

const crashReason = (error: unknown, message: string) =>
    error instanceof ComposePreviewTimeoutError
        ? 'Компонент не отрисовался: плагин перестал отвечать.'
        : `Плагин остановился: ${message.replace(/^Compose preview stopped:\s*/, '')}.`;

/** Плагин перестал рисовать: исключение остановило Compose либо кадр не состоялся за отведённое время. */
const isPluginCrash = (error: unknown) =>
    error instanceof ComposePreviewTimeoutError ||
    (error instanceof ComposePreviewResultError &&
        error.result.type === 'failure' &&
        PLUGIN_CRASH_CODES.includes(error.result.code));

/** Причина отказа, которую передал плагин (`details`); у таймаута и сетевых сбоев её нет. */
const failureDetails = (error: unknown): PreviewFailureDetails | undefined =>
    error instanceof ComposePreviewResultError && error.result.type === 'failure' ? error.result.details : undefined;

const FRAME_LABELS: Record<PreviewPluginPlatform, { title: string; loading: string; rendering: string }> = {
    compose: {
        title: 'Compose component preview',
        loading: 'Loading Compose preview…',
        rendering: 'Rendering Compose preview…',
    },
    web: { title: 'Web component preview', loading: 'Loading web preview…', rendering: 'Rendering web preview…' },
};

const defaultCreateSession: NonNullable<ComposePreviewFrameProps['createSession']> = (plugin, targetWindow, timeoutMs) =>
    new ComposePreviewSession(plugin, { targetWindow, timeoutMs });

export const ComposePreviewFrame = ({
    pluginUrl,
    platform = 'compose',
    payload,
    subscriber = '',
    storyId,
    timeoutMs,
    onDescription,
    onDescriptionError,
    loadManifest = loadComposePreviewManifest,
    createSession = defaultCreateSession,
}: ComposePreviewFrameProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const sessionRef = useRef<ReturnType<NonNullable<ComposePreviewFrameProps['createSession']>>>();
    const latestRequestRef = useRef<string>();
    const latestDescriptionRef = useRef<string>();
    const [status, setStatus] = useState<FrameStatus>('loading');
    const [failure, setFailure] = useState<string>();
    const [failureCause, setFailureCause] = useState<PreviewFailureDetails>();
    const [readyVersion, setReadyVersion] = useState(0);
    // Готова ли текущая сессия: после перезапуска iframe новая сессия ещё грузится, а `readyVersion` остаётся от прежней.
    const sessionReadyRef = useRef(false);
    // Для какого получателя iframe открыт и для какого пришёл последний `success`: кадр одного получателя
    // не показывается другому, пока его собственный payload не отрисован.
    const [revealedFor, setRevealedFor] = useState<string>();
    const [renderedFor, setRenderedFor] = useState<string>();
    const revealed = revealedFor === subscriber;
    const resetReveal = () => {
        setRevealedFor(undefined);
        setRenderedFor(undefined);
    };
    // Остановленный Compose оживает только перезагрузкой iframe; payload, который его остановил, повторно не шлём.
    const [generation, setGeneration] = useState(0);
    const crashedPayloadRef = useRef<string>();
    const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
    // У скрытой страницы браузер останавливает кадры, и плагин не может подтвердить отрисовку: это не сбой.
    const stalledWhileHiddenRef = useRef(false);
    const [resendTick, setResendTick] = useState(0);
    // Первое событие `load` после того, как хост сам назначил `src`, — обычная загрузка, а не перезапуск плагина.
    // Плагин может прислать `ready` раньше `load` (web-плагин шлёт его сразу при старте скрипта); без этого флага
    // `onLoad` сбросил бы уже готовую сессию и ждал второго `ready` до таймаута.
    const initialLoadPendingRef = useRef(false);
    const [crashNotice, setCrashNotice] = useState<{ key: string; message: string; details?: PreviewFailureDetails }>();

    useEffect(() => {
        let cancelled = false;
        const iframe = iframeRef.current;
        if (!iframe) return;

        sessionReadyRef.current = false;
        setStatus('loading');
        setFailure(undefined);
        resetReveal();

        void loadManifest(pluginUrl, platform)
            .then((plugin) => {
                if (cancelled || !iframe.contentWindow) return;
                const session = createSession(plugin, iframe.contentWindow, timeoutMs);
                sessionRef.current = session;
                initialLoadPendingRef.current = true;
                iframe.src = plugin.entrypointUrl.href;
                return session.waitUntilReady();
            })
            .then(() => {
                if (cancelled) return;
                sessionReadyRef.current = true;
                setStatus('ready');
                setReadyVersion((version) => version + 1);
            })
            .catch((error) => {
                if (cancelled) return;
                setFailure(error instanceof Error ? error.message : String(error));
                setStatus('failure');
            });

        return () => {
            cancelled = true;
            sessionRef.current?.dispose();
            sessionRef.current = undefined;
            latestRequestRef.current = undefined;
            latestDescriptionRef.current = undefined;
        };
    }, [pluginUrl, platform, timeoutMs, loadManifest, createSession, generation]);

    const componentId = payload?.component.id;
    useEffect(() => {
        const session = sessionRef.current;
        if (!session || !readyVersion || !sessionReadyRef.current || !componentId) return;

        const { requestId, result } =
            storyId === undefined
                ? session.describeComponent(componentId)
                : session.describeComponent(componentId, storyId);
        latestDescriptionRef.current = requestId;
        void result
            .then((description) => {
                if (latestDescriptionRef.current === requestId) onDescription?.(description);
            })
            .catch((error) => {
                if (latestDescriptionRef.current !== requestId) return;
                onDescriptionError?.(error instanceof Error ? error : new Error(String(error)));
            });
    }, [componentId, storyId, subscriber, readyVersion, onDescription, onDescriptionError]);

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible' || !stalledWhileHiddenRef.current) return;
            stalledWhileHiddenRef.current = false;
            setResendTick((value) => value + 1);
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    useEffect(() => {
        const session = sessionRef.current;
        // До готовности новой сессии не шлём: `send` бросает исключение. Последний payload уйдёт после её `ready`.
        // Без payload область превью скрыта: поздний ответ на прежний запрос уже никому не нужен и не должен
        // перезапускать плагин, если скрытый кадр не успел подтвердиться.
        if (!payload && latestRequestRef.current) {
            latestRequestRef.current = undefined;
            setStatus((current) => (current === 'rendering' ? 'ready' : current));
        }
        if (!session || !readyVersion || !sessionReadyRef.current || !payload) return;
        // Сравнение по содержимому: payload пересобирается при каждом изменении редактора, но тот же самый
        // payload, остановивший плагин, повторно слать нельзя, иначе плагин перезапускается бесконечно.
        if (crashedPayloadRef.current === payloadKey) return;

        setStatus('rendering');
        setFailure(undefined);
        setFailureCause(undefined);
        const { requestId, result } = session.send(payload);
        latestRequestRef.current = requestId;
        const requestedFor = subscriber;

        void result
            .then(() => {
                if (latestRequestRef.current !== requestId) return;
                setRenderedFor(requestedFor);
                setStatus('success');
            })
            .catch((error) => {
                if (latestRequestRef.current !== requestId) return;
                const message = error instanceof Error ? error.message : String(error);
                if (error instanceof ComposePreviewTimeoutError && document.visibilityState === 'hidden') {
                    stalledWhileHiddenRef.current = true;
                    return;
                }
                if (isPluginCrash(error)) {
                    crashedPayloadRef.current = payloadKey;
                    setCrashNotice({
                        key: payloadKey,
                        message: `${crashReason(error, message)} Превью перезапущено.`,
                        details: failureDetails(error),
                    });
                    setGeneration((value) => value + 1);
                    return;
                }
                setFailure(message);
                setFailureCause(failureDetails(error));
                setStatus('failure');
            });
        // Новый получатель получает свой payload, даже если объект тот же: иначе его кадр так и не откроется.
    }, [payload, subscriber, readyVersion, resendTick]);

    // Iframe скрыт до первого успешного render: пока Compose/Wasm поднимается, он рисует белый кадр.
    // Показываем после двух кадров, чтобы нарисованный результат уже был на экране.
    useEffect(() => {
        if (status !== 'success' || renderedFor !== subscriber || revealed) return;
        let second = 0;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(() => setRevealedFor(subscriber));
        });

        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
        };
    }, [status, renderedFor, subscriber, revealed]);

    // Уведомление о сбое относится к payload, который остановил плагин; без payload его нет.
    const activeCrash = crashNotice && payload && crashNotice.key === payloadKey ? crashNotice : undefined;
    const cause = failure ? failureCause : activeCrash?.details;
    const labels = FRAME_LABELS[platform];

    return (
        <FrameRoot data-status={status}>
            <PreviewIframe
                ref={iframeRef}
                title={labels.title}
                // Отказ показывает iframe как раньше, но не кадр, открытый для другого получателя.
                $hidden={!revealed && (status !== 'failure' || revealedFor !== undefined)}
                data-revealed={revealed}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => {
                    if (initialLoadPendingRef.current) {
                        initialLoadPendingRef.current = false;
                        return;
                    }
                    const session = sessionRef.current;
                    if (!session || status === 'loading') return;

                    session.reload();
                    sessionReadyRef.current = false;
                    latestRequestRef.current = undefined;
                    latestDescriptionRef.current = undefined;
                    setFailure(undefined);
                    setStatus('loading');
                    resetReveal();
                    void session
                        .waitUntilReady()
                        .then(() => {
                            if (sessionRef.current !== session) return;
                            sessionReadyRef.current = true;
                            setStatus('ready');
                            setReadyVersion((version) => version + 1);
                        })
                        .catch((error) => {
                            if (sessionRef.current !== session) return;
                            setFailure(error instanceof Error ? error.message : String(error));
                            setStatus('failure');
                        });
                }}
            />
            {(status === 'loading' || (status === 'ready' && !payload && subscriber)) && (
                <Status>{labels.loading}</Status>
            )}
            {status === 'rendering' && <Status>{labels.rendering}</Status>}
            {(failure ?? activeCrash?.message) && <Status role="alert">{failure ?? activeCrash?.message}</Status>}
            {isDebugMode() && cause && <ComposeFailureDetails details={cause} />}
        </FrameRoot>
    );
};
