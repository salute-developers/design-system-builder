import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Config, DesignSystem, type Theme } from '../../controllers';
import type { Meta } from '../../controllers/componentBuilder/type';
import type { ThemeSource } from '../../controllers/designSystem';
import type { ThemePalette } from '../../modules/palette';
import { setActivePalette } from '../../palette/activePalette';

/**
 * Снимок дизайн-системы `base` локального ds-service (тенант `base_default`), снятый загрузчиками клиента
 * (`tokenRepository.loadTokenData`, `componentRepository.loadComponentData`): палитра, данные темы и модели
 * компонентов, нужные web-кейсам превью. Тесты по нему работают без сервиса.
 */
interface WebBaseSnapshot {
    palette: ThemePalette | null;
    themeData: ThemeSource;
    componentsData: Meta[];
}

let cached: WebBaseSnapshot | undefined;

const readSnapshot = (): WebBaseSnapshot =>
    (cached ??= JSON.parse(readFileSync(resolve(__dirname, 'webBase.snapshot.json'), 'utf8')) as WebBaseSnapshot);

export interface WebBaseFixture {
    designSystem: DesignSystem;
    theme: Theme;
    config: (name: string) => Config;
}

/** Дизайн-система и тема из снимка так же, как их собирает редактор: палитра темы активна, доп. токены включены. */
export const loadWebBaseFixture = (): WebBaseFixture => {
    const snapshot = readSnapshot();
    setActivePalette(snapshot.palette);
    const designSystem = DesignSystem.fromSnapshot({
        name: 'base',
        themeData: snapshot.themeData,
        componentsData: snapshot.componentsData,
    });
    const theme = designSystem.createThemeInstance({ includeExtraTokens: true });
    const configs = new Map(designSystem.createAllComponentInstances().map((config) => [config.getName(), config]));
    return {
        designSystem,
        theme,
        config: (name) => {
            const config = configs.get(name);
            if (!config) throw new Error(`Component ${name} is missing in the snapshot`);
            return config;
        },
    };
};

/** Web-кейс превью: компонент, режим и стили, выбранные поверх стилей по умолчанию (по именам). */
export interface WebPreviewCase {
    id: string;
    component: string;
    mode: 'dark' | 'light';
    selections: Record<string, string>;
    background: 'backgroundPrimary';
}

const both = (id: string, component: string, selections: Record<string, string> = {}): WebPreviewCase[] =>
    (['dark', 'light'] as const).map((mode) => ({
        id: `${id}-${mode}`,
        component,
        mode,
        selections,
        background: 'backgroundPrimary',
    }));

export const WEB_PREVIEW_CASES: WebPreviewCase[] = [
    ...both('button-default', 'Button'),
    ...both('button-accent-l-pilled', 'Button', { view: 'accent', size: 'l', shape: 'pilled' }),
    ...both('button-group', 'ButtonGroup', { view: 'accent', size: 's' }),
    ...both('tabs', 'Tabs', { view: 'divider', size: 'm' }),
    ...both('tab-item', 'TabItem', { view: 'divider', size: 'm' }),
    ...both('body', 'Body', { size: 'l' }),
    ...both('chip', 'Chip', { view: 'accent' }),
];

/**
 * Аргументы редактора для кейса так же, как их держит `ComponentEditor`: стили по умолчанию (`getDefaultProps`,
 * порядок `config.getDefaults()`), выбранные стили заменяют их на месте. Значения — идентификаторы стилей.
 */
export const caseArgs = (config: Config, selections: Record<string, string>): Record<string, string> => {
    const args: Record<string, string> = {};
    for (const item of config.getDefaults()) args[item.getVariation()] = item.getStyleID();
    for (const [variationName, styleName] of Object.entries(selections)) {
        const variation = config.getVariations().find((item) => item.getName() === variationName);
        const style = variation?.getStyles()?.find((item) => item.getName() === styleName);
        if (!style) throw new Error(`Style ${variationName}=${styleName} is missing in ${config.getName()}`);
        args[variationName] = style.getID();
    }
    return args;
};
