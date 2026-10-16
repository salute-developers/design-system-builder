import { useMemo, useState } from 'react';

import type { Config, DesignSystem, Theme } from '../../../controllers';
import { useComponentData, useStory } from '../../../hooks';
import {
    createComponentVars,
    createRelatedComponents,
    createRelatedComponentVars,
    createThemeVars,
} from '../../components/features/ComponentEditor/ComponentEditor.utils';

interface ComponentCanvasProps {
    designSystem: DesignSystem;
    theme: Theme;
    config: Config;
    /** Отметка правок темы: тема меняется на месте, переменные пересчитываются по ней. */
    updated: unknown;
}

/** Живой компонент на текущих значениях темы (`canvasComponentExample` прототипа). */
export const ComponentCanvas = ({ designSystem, theme, config, updated }: ComponentCanvasProps) => {
    const [mode, setMode] = useState<'light' | 'dark'>('light');
    const { storyArgs, Story } = useStory(config.getName());
    const [, , , , componentProps] = useComponentData(config, storyArgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- тема меняется на месте, `updated` отмечает правки
    const related = useMemo(() => new Map<string, Config>(), [designSystem, updated]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const themeVars = useMemo(() => createThemeVars(theme, mode) as Record<string, string>, [theme, mode, updated]);

    const variations = config.getVariations();
    const styleName = new Map(
        variations.flatMap(
            (variation) => variation.getStyles()?.map((style) => [style.getID(), style.getName()]) ?? [],
        ),
    );
    const args = Object.fromEntries(
        Object.entries(componentProps).map(([name, value]) => {
            const style = typeof value === 'string' ? styleName.get(value) : undefined;
            return [name, style === undefined ? value : style === 'true' ? true : style];
        }),
    );
    const componentVars = {
        ...createRelatedComponentVars(designSystem, config, componentProps, theme, mode, related),
        ...createComponentVars(config, theme, componentProps, mode),
    };
    const relatedComponents = createRelatedComponents(designSystem, config, theme, mode, related);

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
                    ...componentVars,
                    ...themeVars,
                    background: themeVars['--background-primary'] ?? (mode === 'dark' ? '#000000' : '#FFFFFF'),
                    padding: 24,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 240,
                }}
            >
                {Story ? <Story {...args} relatedComponents={relatedComponents} /> : <p>Для компонента нет превью.</p>}
            </div>
        </div>
    );
};
