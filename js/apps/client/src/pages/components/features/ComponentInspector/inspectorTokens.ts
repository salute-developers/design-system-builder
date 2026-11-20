import { Theme } from '../../../../controllers';
import { restorePaletteColor } from '../../../../palette/activePalette';
import { cssPx } from '../../../../modules/sizeTokens/domain/platformValues';

import type { ColorTokenOption, TokenOption } from '../../../../features/InspectorControls';

export type ThemeMode = 'dark' | 'light';

/** Группа библиотеки прототипа по первому сегменту имени: `surface.default.accent` → «Поверхность». */
const COLOR_GROUPS: Record<string, string> = {
    text: 'Текст',
    surface: 'Поверхность',
    outline: 'Обводка',
    background: 'Фон',
    overlay: 'Наложение',
    data: 'Данные',
};

/** Подгруппа, как её выводит прототип: «Общие», «Акцентные» или «Статусные». */
const colorSubgroup = (name: string) =>
    /(positive|negative|warning|info)/i.test(name) ? 'Статусные' : /accent/i.test(name) ? 'Акцентные' : 'Общие';

/** Цвет токена в режиме темы; `undefined`, если у темы нет такого токена. */
export const resolveColorToken = (theme: Theme, name: string, mode: ThemeMode) => {
    const raw = theme.getTokenValue(`${mode}.${name}`, 'color', 'web');
    return raw ? restorePaletteColor(raw, 0, `${mode}.${name}`) : undefined;
};

/** Токены цвета для библиотеки пикера: имя без режима, цвет в текущем режиме, группа, подгруппа и подтема. */
export const getColorTokenOptions = (theme: Theme, mode: ThemeMode): ColorTokenOption[] =>
    theme
        .getTokens('color')
        // Производные токены (`-hover`, `-active`, `-brightness`) доступны наравне с базовыми: их выбирают для состояний.
        .filter((item) => item.getEnabled() && item.getTags()[0] === mode)
        .map((item) => {
            const [, ...parts] = item.getName().split('.');
            const name = parts.join('.');
            const [group = '', subtheme = 'default'] = parts;
            return {
                value: name,
                label: name,
                color: restorePaletteColor(item.getValue('web'), 0, item.getName()),
                group: COLOR_GROUPS[group] ?? (group ? group[0].toUpperCase() + group.slice(1) : 'Другие'),
                subgroup: colorSubgroup(name),
                // У `background` второй сегмент — режим (`dark`, `light`), а не подтема.
                subtheme: ['on-dark', 'on-light', 'inverse'].includes(subtheme) ? subtheme : 'default',
            };
        });

/**
 * Размер токена в px для подсказки — по правилу экранов токенов (`cssPx`): значение в px остаётся как есть, rem
 * переводится в px. Без значения подсказки нет.
 */
const pxHint = (value: unknown, unit = '') =>
    value === undefined || value === null || value === '' ? undefined : `${cssPx(String(value))}${unit}`;

export const getShapeTokenOptions = (theme: Theme): TokenOption[] =>
    (theme.getTokens('shape') || [])
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'round')
        .map((item) => ({
            value: item.getName(),
            label: item.getName(),
            hint: pxHint(item.getValue('web'), ' px'),
        }));

export const getShadowTokenOptions = (theme: Theme): TokenOption[] =>
    (theme.getTokens('shadow') || [])
        .filter((item) => item.getEnabled())
        .map((item) => ({ value: item.getName(), label: item.getName() }));

export const getTypographyTokenOptions = (theme: Theme): TokenOption[] =>
    theme
        .getTokens('typography')
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'screen-s')
        .map((item) => {
            const [, ...value] = item.getName().split('.');
            const name = value.join('.');
            return { value: name, label: name, hint: pxHint(item.getValue('web')?.fontSize) };
        });
