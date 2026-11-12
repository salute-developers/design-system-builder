import { Theme, PropState } from '../../../../controllers';
import { restorePaletteColor } from '../../../../palette/activePalette';

import type { ColorTokenOption, TokenOption } from '../../../../features/InspectorControls';

export type ThemeMode = 'dark' | 'light';

// Производные токены состояний (`-hover`, `-active`) и служебные `brightness` в списки не попадают.
const isBaseColor = (name: string) => !/(hover|active|brightness)/.test(name);

/** Группа библиотеки прототипа по первому сегменту имени: `surface.default.accent` → Surface. */
const COLOR_GROUPS: Record<string, string> = {
    text: 'Text',
    surface: 'Surface',
    outline: 'Outline',
    background: 'Background',
    overlay: 'Overlay',
    data: 'Data',
};

/** Подгруппа, как её выводит прототип: General, Accent или Status. */
const colorSubgroup = (name: string) =>
    /(positive|negative|warning|info)/i.test(name) ? 'Status' : /accent/i.test(name) ? 'Accent' : 'General';

/** Цвет токена в режиме темы; `undefined`, если у темы нет такого токена. */
export const resolveColorToken = (theme: Theme, name: string, mode: ThemeMode) => {
    const raw = theme.getTokenValue(`${mode}.${name}`, 'color', 'web');
    return raw ? restorePaletteColor(raw, 0, `${mode}.${name}`) : undefined;
};

/** Токены цвета для библиотеки пикера: имя без режима, цвет в текущем режиме, группа, подгруппа и подтема. */
export const getColorTokenOptions = (theme: Theme, mode: ThemeMode): ColorTokenOption[] =>
    theme
        .getTokens('color')
        .filter((item) => item.getEnabled() && item.getTags()[0] === mode && isBaseColor(item.getName()))
        .map((item) => {
            const [, ...parts] = item.getName().split('.');
            const name = parts.join('.');
            const [group = '', subtheme = 'default'] = parts;
            return {
                value: name,
                label: name,
                color: restorePaletteColor(item.getValue('web'), 0, item.getName()),
                group: COLOR_GROUPS[group] ?? (group ? group[0].toUpperCase() + group.slice(1) : 'Other'),
                subgroup: colorSubgroup(name),
                // У `background` второй сегмент — режим (`dark`, `light`), а не подтема.
                subtheme: ['on-dark', 'on-light', 'inverse'].includes(subtheme) ? subtheme : 'default',
            };
        });

/** Состояния цветового свойства: подписи прототипа и порядок, в котором имена соединяются через `+`. */
export const STATE_ORDER: PropState[] = ['focused', 'pressed', 'hovered'];

export const getShapeTokenOptions = (theme: Theme): TokenOption[] =>
    (theme.getTokens('shape') || [])
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'round')
        .map((item) => ({
            value: item.getName(),
            label: item.getName(),
            hint: `${parseFloat(item.getValue('web')) * 16} px`,
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
            return { value: name, label: name, hint: `${parseFloat(item.getValue('web').fontSize) * 16}` };
        });
