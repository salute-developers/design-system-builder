import { useEffect, useState } from 'react';

import type { Config, DesignSystem, Theme } from '../controllers';
import { assembleComposePreviewPayload, type AssemblyResult } from './assembler';
import { getWebPreviewPluginUrl } from './config';
import { createComponentPreviewDraft } from './draft';
import { loadComposePreviewManifest } from './manifest';
import { collectRelatedConfigs } from './relatedConfigs';
import type { JsonValue } from './types';

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

export type WebPreviewPluginState =
    | { status: 'loading'; pluginUrl: string }
    | { status: 'available'; pluginUrl: string }
    | { status: 'unavailable'; reason: string };

/**
 * Доступность web-плагина для компонента: адрес задан, манифест загрузился и перечисляет компонент. Без плагина
 * превью web-компонента нет, причина показывается в области превью. `componentName` без значения — не web-компонент:
 * манифест не загружается.
 */
export const useWebPreviewPlugin = (componentName: string | undefined): WebPreviewPluginState => {
    const pluginUrl = getWebPreviewPluginUrl();
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

    if (!pluginUrl) {
        return { status: 'unavailable', reason: 'адрес web-плагина превью не задан (VITE_WEB_PREVIEW_PLUGIN_URL)' };
    }
    if (!componentName || manifest?.url !== pluginUrl) return { status: 'loading', pluginUrl };
    if (manifest.error !== undefined) {
        return { status: 'unavailable', reason: `манифест web-плагина не загрузился: ${manifest.error}` };
    }
    if (!manifest.components?.includes(componentName)) {
        return { status: 'unavailable', reason: `компонент ${componentName} не зарегистрирован в web-плагине` };
    }
    return { status: 'available', pluginUrl };
};
