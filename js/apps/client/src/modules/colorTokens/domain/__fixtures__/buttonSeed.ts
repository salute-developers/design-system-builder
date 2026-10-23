/**
 * Данные вариации `view` компонента Button из базовой дизайн-системы: свойства с web-параметром и
 * значения по стилям (токен и состояние). Снимок прежних сидов db-service, служит примером реального компонента.
 */

/** Свойства Button, у которых есть web-параметр. */
export const buttonWebProps: ReadonlySet<string> = new Set(['shape', 'spinnerColor', 'valueColor', 'focusColor', 'disableAlpha', 'height', 'paddingEnd', 'minWidth', 'spinnerSize', 'iconMargin', 'valueMargin', 'labelStyle', 'backgroundColor', 'loadingBackgroundColor', 'labelColor']);

/** Значения свойств по стилям вариации `view`. */
export const buttonViewValues: Record<string, Array<{ prop: string; token: string; state?: string }>> = {
    default: [
        { prop: 'backgroundColor', token: 'surface.default.solid-default' },
        { prop: 'backgroundColor', token: 'surface.default.solid-default-hover', state: 'hovered' },
        { prop: 'loadingBackgroundColor', token: 'surface.default.solid-default' },
        { prop: 'backgroundColor', token: 'surface.default.solid-default-active', state: 'pressed' },
        { prop: 'labelColor', token: 'text.inverse.primary' },
        { prop: 'spinnerColor', token: 'text.inverse.primary' },
        { prop: 'valueColor', token: 'text.inverse.secondary' },
    ],
    secondary: [
        { prop: 'backgroundColor', token: 'surface.default.transparent-secondary' },
        { prop: 'backgroundColor', token: 'surface.default.transparent-secondary-active', state: 'pressed' },
        { prop: 'labelColor', token: 'text.default.primary' },
        { prop: 'spinnerColor', token: 'text.default.primary' },
        { prop: 'backgroundColor', token: 'surface.default.transparent-secondary-hover', state: 'hovered' },
        { prop: 'loadingBackgroundColor', token: 'surface.default.transparent-secondary' },
        { prop: 'valueColor', token: 'text.default.secondary' },
    ],
    accent: [
        { prop: 'backgroundColor', token: 'surface.default.accent' },
        { prop: 'backgroundColor', token: 'surface.default.accent-active', state: 'pressed' },
        { prop: 'labelColor', token: 'text.on-dark.primary' },
        { prop: 'spinnerColor', token: 'text.on-dark.primary' },
        { prop: 'backgroundColor', token: 'surface.default.accent-hover', state: 'hovered' },
        { prop: 'loadingBackgroundColor', token: 'surface.default.accent' },
        { prop: 'valueColor', token: 'text.on-dark.secondary' },
    ],
    clear: [
        { prop: 'backgroundColor', token: 'surface.default.clear' },
        { prop: 'backgroundColor', token: 'surface.default.transparent-secondary-active', state: 'pressed' },
        { prop: 'labelColor', token: 'text.default.primary' },
        { prop: 'spinnerColor', token: 'text.default.primary' },
        { prop: 'backgroundColor', token: 'surface.default.transparent-secondary-hover', state: 'hovered' },
        { prop: 'loadingBackgroundColor', token: 'surface.default.clear' },
        { prop: 'valueColor', token: 'text.default.secondary' },
    ],
};
