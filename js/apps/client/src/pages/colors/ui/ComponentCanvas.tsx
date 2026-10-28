import { useMemo, useRef, useState } from 'react';

import type { Config, DesignSystem, Theme } from '../../../controllers';
import { useComponentData } from '../../../hooks';
import {
    ComposePreviewSlot,
    DEFAULT_WEB_STORY_ID,
    assembleWebPreviewPayload,
    useWebPreviewPlugin,
    type PreviewPayloadInput,
} from '../../../composePreview';
import { restorePaletteColor } from '../../../palette/activePalette';

interface ComponentCanvasProps {
    designSystem: DesignSystem;
    theme: Theme;
    config: Config;
    /** Отметка правок темы: тема меняется на месте, payload пересобирается по ней. */
    updated: unknown;
}

/**
 * Живой компонент на текущих значениях темы (`canvasComponentExample` прототипа). Рисует его web-плагин превью
 * по тому же payload, что и раздел компонентов; без плагина канвас показывает причину.
 */
export const ComponentCanvas = ({ designSystem, theme, config, updated }: ComponentCanvasProps) => {
    const [mode, setMode] = useState<'light' | 'dark'>('light');
    const [, , , , componentProps] = useComponentData(config);
    const plugin = useWebPreviewPlugin(config.getName());
    const related = useMemo(() => new Map<string, Config>(), [designSystem, updated]);
    const backgroundToken = `${mode}.background.default.primary`;
    const payloadCache = useRef<{ key: string; payload: PreviewPayloadInput }>();

    const assembly = useMemo(() => {
        if (plugin.status !== 'available') return undefined;
        const result = assembleWebPreviewPayload({
            config,
            theme,
            args: componentProps,
            themeMode: mode,
            storyId: DEFAULT_WEB_STORY_ID,
            storyProps: {},
            backgroundToken,
            designSystem,
            relatedConfigs: related,
        });
        if (!result.ok) return { error: result.diagnostics[0]?.message ?? 'payload не собран' };
        // Объект меняется только вместе с содержимым: каждый новый объект уходит в плагин отдельным payload.
        const key = JSON.stringify(result.payload);
        if (payloadCache.current?.key !== key) payloadCache.current = { key, payload: result.payload };
        return { payload: payloadCache.current.payload };
    }, [plugin.status, config, theme, componentProps, mode, backgroundToken, designSystem, related, updated]);

    const background =
        restorePaletteColor(theme.getTokenValue(backgroundToken, 'color', 'web') || '', -1, backgroundToken) ||
        (mode === 'dark' ? '#000000' : '#FFFFFF');
    const unavailable = plugin.status === 'unavailable' ? plugin.reason : assembly?.error;

    return (
        <div
            className="component-preview-stage component-preview-stage-inline"
            data-testid="color-tokens-component-canvas"
        >
            <div className="workspace-tabs" role="group" aria-label="Режим превью">
                {(['light', 'dark'] as const).map((item) => (
                    <button
                        key={item}
                        type="button"
                        className={mode === item ? 'is-active' : ''}
                        onClick={() => setMode(item)}
                    >
                        {item === 'light' ? 'Light' : 'Dark'}
                    </button>
                ))}
            </div>
            <div
                style={{
                    background,
                    padding: 24,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 240,
                }}
            >
                {unavailable ? (
                    <p role="alert">Превью недоступно: {unavailable}</p>
                ) : plugin.status === 'available' && assembly?.payload ? (
                    <ComposePreviewSlot
                        platform="web"
                        pluginUrl={plugin.pluginUrl}
                        owner={`colors:${config.getName()}`}
                        payload={assembly.payload}
                    />
                ) : null}
            </div>
        </div>
    );
};
