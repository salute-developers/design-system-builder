import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { http } from '../api/http';
import { apiRoot } from '../api/editorHttp';
import type { Parameters } from '../types';
import type { CoreRelease } from '../api/coreCompatibilityRepository';
import { getComposePreviewPluginOverride, getWebPreviewPluginOverride } from './config';

/** Выбирает сборку по DS/version; запоздалый ответ другого контекста не попадает в хост. */
export const useCorePreview = (platform: 'web' | 'compose', parameters?: Partial<Parameters>, enabled = true) => {
    const location = useLocation();
    const versionId = new URLSearchParams(location.search).get('versionId') ?? undefined;
    const projectId = parameters?.projectId;
    const designSystemId = parameters?.designSystemId;
    const key = JSON.stringify([platform, projectId, designSystemId, versionId, enabled]);
    const override = platform === 'compose' ? getComposePreviewPluginOverride() : getWebPreviewPluginOverride();
    const [state, setState] = useState<{
        key: string;
        pluginUrl?: string;
        coreRelease?: CoreRelease;
        buildId?: string;
        error?: string; developmentOverride?: boolean;
    }>({ key: '' });
    useEffect(() => {
        if (!enabled || override || !projectId || !designSystemId) return;
        let controller: AbortController | undefined;
        const read = () => {
            controller?.abort();
            const attempt = new AbortController();
            controller = attempt;
            void http
                .get<{ pluginUrl: string; coreRelease: CoreRelease; buildId: string }>(
                    `${apiRoot(projectId, designSystemId)}/preview/${platform}`,
                    { params: { versionId }, signal: attempt.signal },
                )
                .then(({ data }) => {
                    if (!attempt.signal.aborted) setState({ key, ...data });
                })
                .catch((error: unknown) => {
                    if (!attempt.signal.aborted)
                        setState({
                            key,
                            error:
                                isAxiosError(error) && error.response?.status === 404
                                    ? 'Для выбранного Core пока нет preview'
                                    : 'Не удалось загрузить preview',
                        });
                });
        };
        read();
        const timer = window.setInterval(read, 30_000);
        window.addEventListener('focus', read);
        return () => {
            controller?.abort();
            window.clearInterval(timer);
            window.removeEventListener('focus', read);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, override]);
    if (override) return { pluginUrl: override, key, developmentOverride: true };
    return state.key === key ? state : { key };
};
