import { COLOR_MODES, parseMemberName } from './family';
import type { ColorMode, ColorTokenKey } from './types';

/** Цветовое свойство стиля компонента: значение — имя токена без режима, например `surface.default.accent`. */
export interface StyleColorProp {
    name: string;
    token: string;
    /** Значения состояний: `hovered`, `pressed`; без явного значения — токен с суффиксом `-hover`, `-active`. */
    states: Array<{ state: string; token?: string }>;
    /** Есть ли у свойства web-отображение: без него свойство не попадает в пары. */
    web: boolean;
}

export interface ComponentStyleSource {
    component: string;
    variation: string;
    style: string;
    props: StyleColorProp[];
}

export type PairKind = 'text' | 'ui';

export interface ContrastPair {
    component: string;
    variation: string;
    style: string;
    state: 'Default' | 'Hover' | 'Active';
    mode: ColorMode;
    backgroundToken: string;
    foregroundToken: string;
    kind: PairKind;
    ratio: number | null;
    threshold: 4.5 | 3;
    pass: boolean;
}

/** Цвет токена темы (`dark.text.default.primary`) как HEX с альфой или `null`. */
export type ThemeColorResolver = (themeTokenName: string) => string | null;

type Role = 'background' | 'text' | 'ui';

const roleByName = (name: string): Role | null => {
    if (/divider/i.test(name)) return null;
    if (/background|fillcolor|^track|thumbbackground/i.test(name)) return 'background';
    if (/icon|spinner|border|outline|focus/i.test(name)) return 'ui';
    if (/^(color|labelcolor|textcolor|valuecolor)$|titlecolor$|textcolor$|labelcolor$/i.test(name)) return 'text';
    return null;
};

const roleByToken = (token: string): Role | null => {
    const group = token.split('.')[0];
    if (group === 'surface' || group === 'background') return 'background';
    if (group === 'text') return 'text';
    if (group === 'outline') return 'ui';
    return null;
};

const STATES = [
    { label: 'Default', key: null, suffix: '' },
    { label: 'Hover', key: 'hovered', suffix: '-hover' },
    { label: 'Active', key: 'pressed', suffix: '-active' },
] as const;

const tokenForState = (prop: StyleColorProp, state: (typeof STATES)[number]) => {
    if (!state.key) return prop.token;
    const explicit = prop.states.find((item) => item.state === state.key);
    return explicit?.token ?? `${prop.token}${state.suffix}`;
};

interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

const parseHex = (value: string | null): Rgba | null => {
    const hex = value?.trim().replace('#', '') ?? '';
    const full = hex.length === 3 || hex.length === 4 ? [...hex].map((c) => c + c).join('') : hex;
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) return null;
    const channel = (index: number) => parseInt(full.slice(index, index + 2), 16);
    return { r: channel(0), g: channel(2), b: channel(4), a: full.length === 8 ? channel(6) / 255 : 1 };
};

/** Наложение цвета с прозрачностью на непрозрачный фон. */
export const compositeOver = (foreground: Rgba, background: Rgba): Rgba => ({
    r: Math.round(foreground.r * foreground.a + background.r * (1 - foreground.a)),
    g: Math.round(foreground.g * foreground.a + background.g * (1 - foreground.a)),
    b: Math.round(foreground.b * foreground.a + background.b * (1 - foreground.a)),
    a: 1,
});

const luminance = ({ r, g, b }: Rgba) => {
    const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** Коэффициент контраста WCAG: передний план накладывается на фон, фон — на основной фон режима. */
export const contrastRatio = (foreground: string | null, background: string | null, base: string | null) => {
    const fg = parseHex(foreground);
    const bg = parseHex(background);
    const canvas = parseHex(base) ?? { r: 255, g: 255, b: 255, a: 1 };
    if (!fg || !bg) return null;
    const solidBg = compositeOver(bg, { ...canvas, a: 1 });
    const solidFg = compositeOver(fg, solidBg);
    const [light, dark] = [luminance(solidFg), luminance(solidBg)].sort((a, b) => b - a);
    return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
};

const belongsTo = (token: string, key: ColorTokenKey) => {
    const parsed = parseMemberName(token);
    return parsed !== null && parsed.group === key.group && parsed.name === key.name;
};

/** Основной фон стиля: `background` или `backgroundColor`, иначе первое свойство фона. */
const primaryBackground = (props: Array<StyleColorProp & { role: Role }>) =>
    props.find((prop) => prop.role === 'background' && /^background(color)?$/i.test(prop.name)) ??
    props.find((prop) => prop.role === 'background');

/**
 * Пары «фон ↔ передний план» в стилях компонентов, где участвует токен [key]: для каждого режима и состояний
 * Default, Hover и Active. Порог 4.5 — текст, 3 — иконки и контуры.
 */
export const collectContrastPairs = (
    sources: ComponentStyleSource[],
    key: ColorTokenKey,
    resolve: ThemeColorResolver,
): ContrastPair[] =>
    sources.flatMap((source) => {
        const props = source.props
            .filter((prop) => prop.web)
            .map((prop) => ({ ...prop, role: roleByName(prop.name) ?? roleByToken(prop.token) }))
            .filter((prop): prop is StyleColorProp & { role: Role } => prop.role !== null);
        const background = primaryBackground(props);
        if (!background) return [];
        const foregrounds = props.filter((prop) => prop.role !== 'background');
        return foregrounds.flatMap((foreground) =>
            STATES.flatMap((state) => {
                const bgToken = tokenForState(background, state);
                const fgToken =
                    state.key && !foreground.states.length ? foreground.token : tokenForState(foreground, state);
                if (!belongsTo(bgToken, key) && !belongsTo(fgToken, key)) return [];
                if (state.key && bgToken === background.token && fgToken === foreground.token) return [];
                return COLOR_MODES.map((mode) => {
                    const kind: PairKind = foreground.role === 'text' ? 'text' : 'ui';
                    const threshold = kind === 'text' ? 4.5 : 3;
                    const ratio = contrastRatio(
                        resolve(`${mode}.${fgToken}`),
                        resolve(`${mode}.${bgToken}`),
                        resolve(`${mode}.background.default.primary`),
                    );
                    return {
                        component: source.component,
                        variation: source.variation,
                        style: source.style,
                        state: state.label,
                        mode,
                        backgroundToken: bgToken,
                        foregroundToken: fgToken,
                        kind,
                        ratio,
                        threshold,
                        pass: ratio !== null && ratio >= threshold,
                    } satisfies ContrastPair;
                });
            }),
        );
    });
