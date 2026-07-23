import { useEffect, useRef, useState } from 'react';

import { loadComposePreviewManifest } from './manifest';
import { ComposePreviewSession } from './session';
import { PreviewPayload } from './types';
import type { LoadedComposePreviewManifest } from './types';
import { FrameRoot, PreviewIframe, Status } from './ComposePreviewFrame.styles';

interface ComposePreviewFrameProps {
    pluginUrl: string;
    payload: PreviewPayload;
    timeoutMs?: number;
    loadManifest?: (pluginUrl: string) => Promise<LoadedComposePreviewManifest>;
    createSession?: (
        plugin: LoadedComposePreviewManifest,
        targetWindow: Window,
        timeoutMs?: number,
    ) => Pick<ComposePreviewSession, 'waitUntilReady' | 'send' | 'reload' | 'dispose'>;
}

type FrameStatus = 'loading' | 'ready' | 'rendering' | 'success' | 'failure';

const defaultCreateSession: NonNullable<ComposePreviewFrameProps['createSession']> = (plugin, targetWindow, timeoutMs) =>
    new ComposePreviewSession(plugin, { targetWindow, timeoutMs });

export const ComposePreviewFrame = ({
    pluginUrl,
    payload,
    timeoutMs,
    loadManifest = loadComposePreviewManifest,
    createSession = defaultCreateSession,
}: ComposePreviewFrameProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const sessionRef = useRef<ReturnType<NonNullable<ComposePreviewFrameProps['createSession']>>>();
    const latestRequestRef = useRef<string>();
    const [status, setStatus] = useState<FrameStatus>('loading');
    const [failure, setFailure] = useState<string>();
    const [readyVersion, setReadyVersion] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const iframe = iframeRef.current;
        if (!iframe) return;

        setStatus('loading');
        setFailure(undefined);

        void loadManifest(pluginUrl)
            .then((plugin) => {
                if (cancelled || !iframe.contentWindow) return;
                const session = createSession(plugin, iframe.contentWindow, timeoutMs);
                sessionRef.current = session;
                iframe.src = plugin.entrypointUrl.href;
                return session.waitUntilReady();
            })
            .then(() => {
                if (cancelled) return;
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
        };
    }, [pluginUrl, timeoutMs, loadManifest, createSession]);

    useEffect(() => {
        const session = sessionRef.current;
        if (!session || !readyVersion) return;

        setStatus('rendering');
        setFailure(undefined);
        const { requestId, result } = session.send(payload);
        latestRequestRef.current = requestId;

        void result
            .then(() => {
                if (latestRequestRef.current === requestId) setStatus('success');
            })
            .catch((error) => {
                if (latestRequestRef.current !== requestId) return;
                setFailure(error instanceof Error ? error.message : String(error));
                setStatus('failure');
            });
    }, [payload, readyVersion]);

    return (
        <FrameRoot data-status={status}>
            <PreviewIframe
                ref={iframeRef}
                title="Compose component preview"
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => {
                    if (sessionRef.current && status !== 'loading') sessionRef.current.reload();
                }}
            />
            {status === 'loading' && <Status>Loading Compose preview…</Status>}
            {status === 'rendering' && <Status>Rendering Compose preview…</Status>}
            {failure && <Status role="alert">{failure}</Status>}
        </FrameRoot>
    );
};
