import { useEffect, useState } from 'react';

import type { Config, DesignSystem, Theme } from '../controllers';
import { assembleComposePreviewPayload, type AssemblyResult } from './assembler';
import { getWebPreviewPluginOverride } from './config';
import { createComponentPreviewDraft } from './draft';
import { loadComposePreviewManifest } from './manifest';
import { collectRelatedConfigs } from './relatedConfigs';
import type { JsonValue } from './types';
import { resolveWebPreviewPluginUrl, type WebPluginDescriptorFetcher } from './webPluginLocation';

/** Story web-плагина до ответа `describe`: плагин описывает story `Default`. */
export const DEFAULT_WEB_STORY_ID = 'Default';

export interface WebPreviewPayloadOptions {
    config: Config;
    theme: Theme;
    /** Выбор редактора: вариация → идентификатор стиля. Прочие ключи игнорируются. */
    args: Record<string, unknown>;
    themeMode: string;
    /** Story плагина из ответа `describe`. */
    storyId: string;
    /** Аргументы story, отличные от значений по умолчанию. */
    storyProps: Record<string, JsonValue>;
    /** Токен темы фона области превью (`dark.background.default.primary`): попадает в `theme` и `surface.background`. */
    backgroundToken: string;
    /** Дизайн-система компонента: из неё берутся связанные компоненты. Без неё в `styles` только сам компонент. */
    designSystem?: DesignSystem;
    /** Экземпляры `Config` связанных компонентов между пересборками payload. */
    relatedConfigs?: Map<string, Config>;
}

/**
 * Payload платформы `WEB` тем же ассемблером, что и Compose: свойства по каноническому имени, тема — web-значения
 * в единицах протокола, связанные компоненты — в `styles`. Перевод в CSS делает web-плагин.
 */
export const assembleWebPreviewPayload = ({
    config,
    theme,
    args,
    themeMode,
    storyId,
    storyProps,
    backgroundToken,
    designSystem,
    relatedConfigs,
}: WebPreviewPayloadOptions): AssemblyResult => {
    const draft = createComponentPreviewDraft({
        config,
        theme,
        rendererPlatform: 'WEB',
        relatedConfigs: designSystem ? collectRelatedConfigs(designSystem, config, relatedConfigs) : [config],
        previewMetadata: { componentId: config.getName(), storyId },
        args,
        variationSelections: args,
        exampleProps: storyProps,
        themeMode,
        themeValuePlatform: 'web',
        surface: { width: 360, height: 160, background: backgroundToken },
    });
    return draft.ok ? assembleComposePreviewPayload(draft.draft) : draft;
};

/** Адрес web-плагина: прямой из сборки либо от бэкенда. */
export type WebPreviewPluginLocation =
    /** Адрес не нужен (нет проекта или web-компонентов) или ещё запрашивается. */
    | { status: 'pending' }
    /** Адрес известен; `undefined` — web-плагин не опубликован (`404`). */
    | { status: 'resolved'; pluginUrl: string | undefined }
    | { status: 'failed'; error: string };

/**
 * Адрес web-плагина для проекта. Непустая `VITE_WEB_PREVIEW_PLUGIN_URL` возвращается сразу, без запроса к бэкенду;
 * иначе адрес запрашивается у бэкенда — один раз на страницу и проект (кеш {@link resolveWebPreviewPluginUrl}).
 * Без `projectId` запроса нет: вызывающий передаёт его, только когда web-плагин действительно нужен.
 */
export const useWebPreviewPluginLocation = (
    projectId: string | undefined,
    fetchDescriptor: WebPluginDescriptorFetcher,
): WebPreviewPluginLocation => {
    const override = getWebPreviewPluginOverride();
    const [resolved, setResolved] = useState<{ projectId: string; location: WebPreviewPluginLocation }>();

    useEffect(() => {
        if (override || !projectId) return;
        let cancelled = false;
        resolveWebPreviewPluginUrl(projectId, fetchDescriptor).then(
            (pluginUrl) => {
                if (!cancelled) setResolved({ projectId, location: { status: 'resolved', pluginUrl } });
            },
            (error: unknown) => {
                if (!cancelled) {
                    const message = error instanceof Error ? error.message : String(error);
                    setResolved({ projectId, location: { status: 'failed', error: message } });
                }
            },
        );
        return () => {
            cancelled = true;
        };
    }, [override, projectId, fetchDescriptor]);

    if (override) return { status: 'resolved', pluginUrl: override };
    if (!projectId || resolved?.projectId !== projectId) return { status: 'pending' };
    return resolved.location;
};

export type WebPreviewPluginState =
    | { status: 'loading' }
    | { status: 'available'; pluginUrl: string }
    | { status: 'unavailable'; reason: string };

/**
 * Доступность web-плагина для компонента: адрес известен (прямой из сборки или от бэкенда), манифест загрузился и
 * перечисляет компонент. Без плагина превью web-компонента нет, причина показывается в области превью.
 * `componentName` без значения — не web-компонент: ни адрес, ни манифест не запрашиваются.
 */
export const useWebPreviewPlugin = (
    componentName: string | undefined,
    projectId: string | undefined,
    fetchDescriptor: WebPluginDescriptorFetcher,
): WebPreviewPluginState => {
    const location = useWebPreviewPluginLocation(componentName ? projectId : undefined, fetchDescriptor);
    const pluginUrl = location.status === 'resolved' ? location.pluginUrl : undefined;
    const [manifest, setManifest] = useState<{ url: string; components?: string[]; error?: string }>();

    useEffect(() => {
        if (!pluginUrl || !componentName) return;
        let cancelled = false;
        // Проверки WebAssembly для web-плагина нет: это обычное React-приложение.
        void loadComposePreviewManifest(pluginUrl, 'web')
            .then((plugin) => {
                if (!cancelled) setManifest({ url: pluginUrl, components: plugin.manifest.components });
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setManifest({ url: pluginUrl, error: error instanceof Error ? error.message : String(error) });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [pluginUrl, componentName]);

    if (!componentName) return { status: 'loading' };
    if (location.status === 'pending') {
        // Без проекта адрес у бэкенда спросить нельзя, а прямого адреса нет.
        return projectId
            ? { status: 'loading' }
            : { status: 'unavailable', reason: 'адрес web-плагина превью неизвестен: проект не выбран' };
    }
    if (location.status === 'failed') {
        return { status: 'unavailable', reason: `адрес web-плагина превью не получен: ${location.error}` };
    }
    if (!location.pluginUrl) {
        return { status: 'unavailable', reason: 'web-плагин превью не опубликован' };
    }
    if (manifest?.url !== location.pluginUrl) return { status: 'loading' };
    if (manifest.error !== undefined) {
        return { status: 'unavailable', reason: `манифест web-плагина не загрузился: ${manifest.error}` };
    }
    if (!manifest.components?.includes(componentName)) {
        return { status: 'unavailable', reason: `компонент ${componentName} не зарегистрирован в web-плагине` };
    }
    return { status: 'available', pluginUrl: location.pluginUrl };
};
