/** Модель раздела «Отступы, радиусы и тени»: токены размеров темы в px по ответу `ds-service`. */

/** Платформа, у которой бывает своё значение; без него значение строится из веба. */
export type NativePlatform = 'ios' | 'android';

export const NATIVE_PLATFORMS: readonly NativePlatform[] = ['ios', 'android'];

export const PLATFORM_LABELS: Record<NativePlatform, string> = { ios: 'iOS', android: 'Android' };

/** Раздел экрана: радиусы (`shape`), отступы (`spacing`) и тени (`shadow`). */
export type SizeTokenKind = 'radius' | 'spacing' | 'shadow';

export const SIZE_TOKEN_KINDS: readonly SizeTokenKind[] = ['radius', 'spacing', 'shadow'];

/** Тип токена темы для раздела. */
export const THEME_TOKEN_TYPE = { radius: 'shape', spacing: 'spacing', shadow: 'shadow' } as const;

export type ThemeSizeTokenType = (typeof THEME_TOKEN_TYPE)[SizeTokenKind];

/** Компонент дизайн-системы и число значений его свойств, которые ссылаются на токен. */
export interface ComponentUsage {
    name: string;
    count: number;
}

/** Слой тени в px; цвет — `#RRGGBB` или `#RRGGBBAA`. */
export interface ShadowLayer {
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: string;
}

/** Компонент, платформа и параметр, где у ссылки на радиус задано смещение. */
export interface DerivedUsage {
    component: string;
    platform: string;
    parameter: string | null;
}

/** Вычисляемый радиус: смещение источника у значений свойств компонентов. */
export interface DerivedRadius {
    offsetPx: number;
    valuePx: number;
    usages: DerivedUsage[];
}

/** Радиус или отступ. */
export interface DimensionToken {
    kind: 'radius' | 'spacing';
    tokenId: string;
    /** Полное имя: `round.m`, `spacing.4x`. */
    name: string;
    /** Значение веба; `null` только у полного скругления. */
    valuePx: number | null;
    /** `round.circle`: значение не правится. */
    fullRounding: boolean;
    /** Свои значения платформ (`overridden: true`). */
    platforms: Partial<Record<NativePlatform, number>>;
    /** Текущие числа платформ независимо от признака. */
    native: Record<NativePlatform, number | null>;
    /** Есть платформа без своего значения, чьё число отличается от веба. */
    platformsDiffer: boolean;
    components: ComponentUsage[];
    /** Вычисляемые радиусы; у отступа пусто. */
    derived: DerivedRadius[];
}

/** Вариант тени: `down.soft.m`. */
export interface ShadowToken {
    kind: 'shadow';
    tokenId: string;
    name: string;
    /** Слои веба. */
    layers: ShadowLayer[];
    /** Запасная высота Android из первого слоя, без неё 0. */
    fallbackElevation: number;
    /** Свои слои платформ (`overridden: true`). */
    platforms: Partial<Record<NativePlatform, { layers: ShadowLayer[] }>>;
    native: Record<NativePlatform, { layers: ShadowLayer[] } | null>;
    platformsDiffer: boolean;
    components: ComponentUsage[];
}

export type SizeToken = DimensionToken | ShadowToken;

/** Раздел темы: токены, ревизия темы и право изменения. */
export interface SizeTokens {
    editRevision: number;
    canEdit: boolean;
    tokens: SizeToken[];
}

/** Новое значение токена: веб и свои значения платформ; платформа без ключа строится из веба. */
export type SizeTokenValue =
    | { kind: 'dimension'; valuePx: number; platforms: Partial<Record<NativePlatform, number>> }
    | {
          kind: 'shadow';
          layers: ShadowLayer[];
          fallbackElevation: number;
          platforms: Partial<Record<NativePlatform, ShadowLayer[]>>;
      };

/** Вариант размера тени: направление и жёсткость. */
export type ShadowVariant = 'down.soft' | 'down.hard' | 'up.soft' | 'up.hard';

export const SHADOW_VARIANTS: readonly ShadowVariant[] = ['down.soft', 'down.hard', 'up.soft', 'up.hard'];

/** Тело операции создания: радиус или отступ — имя без префикса и значение, тень — размер и четыре варианта. */
export type CreateSizeTokenRequest =
    | { kind: 'radius' | 'spacing'; name: string; valuePx: number }
    | {
          kind: 'shadow';
          name: string;
          variants: Array<{ variant: ShadowVariant; layers: ShadowLayer[]; fallbackElevation: number }>;
      };

/** Значение платформы, записанное операцией, в формате хранения. */
export interface WrittenValue {
    platform: 'web' | 'ios' | 'android';
    value: unknown;
    overridden: boolean;
}
