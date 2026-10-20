import type { ShadowLayer } from './types';

/** Тексты проверок значений — таблица `design.md` (те же тексты возвращает `ds-service`). */
export const SIZE_MESSAGES = {
    empty: 'Значение не может быть пустым.',
    number: 'Размер должен быть числом.',
    integer: 'Размер должен быть целым числом.',
    range: (min: number, max: number) => `Значение должно быть в диапазоне ${min}–${max} px.`,
    hex: 'Цвет должен быть в формате Hex.',
    opacity: 'Прозрачность — от 0 до 100%.',
    noLayers: 'У тени должен быть хотя бы один слой.',
    tooManyLayers: 'У тени не больше 4 слоёв.',
    name: 'Введите имя токена: латиница и цифры.',
    exists: (name: string) => `Токен ${name} уже есть в теме.`,
} as const;

export interface Range {
    min: number;
    max: number;
}

/** Диапазоны значений. */
export const RANGES = {
    radius: { min: 0, max: 1000 },
    spacing: { min: 0, max: 128 },
    offset: { min: -200, max: 200 },
    blur: { min: 0, max: 200 },
    elevation: { min: 0, max: 24 },
} as const satisfies Record<string, Range>;

export const MAX_SHADOW_LAYERS = 4;

/** Поле слоя тени с числом. */
export type LayerNumberKey = 'offsetX' | 'offsetY' | 'blur' | 'spread';

export const LAYER_RANGES: Record<LayerNumberKey, Range> = {
    offsetX: RANGES.offset,
    offsetY: RANGES.offset,
    blur: RANGES.blur,
    spread: RANGES.offset,
};

/** Ввод целых px: текст проверки или `null`. */
export const validatePx = (raw: string, range: Range): string | null => {
    const text = raw.trim();
    if (!text) return SIZE_MESSAGES.empty;
    const value = Number(text.replace(',', '.'));
    if (!Number.isFinite(value)) return SIZE_MESSAGES.number;
    if (!Number.isInteger(value)) return SIZE_MESSAGES.integer;
    if (value < range.min || value > range.max) return SIZE_MESSAGES.range(range.min, range.max);
    return null;
};

/** Число из проверенного ввода. */
export const parsePx = (raw: string) => Number(raw.trim().replace(',', '.'));

const HEX6 = /^#?([0-9a-f]{6})$/i;

/** HEX цвета слоя без прозрачности: `#RRGGBB` или `null`. */
export const parseHex = (raw: string) => {
    const match = HEX6.exec(raw.trim());
    return match ? `#${match[1].toUpperCase()}` : null;
};

/** Прозрачность в процентах из ввода «24» или «24%»: число или `null`. */
export const parseOpacity = (raw: string) => {
    const text = raw.trim().replace('%', '').trim();
    if (!text) return null;
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
};

/** Прозрачность цвета слоя в процентах. */
export const opacityOf = (color: string) =>
    color.length === 9 ? Math.round((parseInt(color.slice(7), 16) / 255) * 100) : 100;

/** Цвет слоя `#RRGGBBAA` в верхнем регистре: `#000000` и 24 % → `#0000003D`. */
export const colorWithOpacity = (hex: string, percent: number) =>
    `${hex.slice(0, 7).toUpperCase()}${Math.round((percent / 100) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase()}`;

/** Проверка слоёв тени перед отправкой: текст или `null`. */
export const validateLayers = (layers: readonly ShadowLayer[]): string | null => {
    if (!layers.length) return SIZE_MESSAGES.noLayers;
    if (layers.length > MAX_SHADOW_LAYERS) return SIZE_MESSAGES.tooManyLayers;
    for (const layer of layers) {
        for (const key of Object.keys(LAYER_RANGES) as LayerNumberKey[]) {
            const message = validatePx(String(layer[key]), LAYER_RANGES[key]);
            if (message) return message;
        }
        if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(layer.color)) return SIZE_MESSAGES.hex;
    }
    return null;
};
