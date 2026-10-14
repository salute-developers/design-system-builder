import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'disableAlpha', type: 'float', description: 'Значение прозрачности в отключенном варианте', defaultValue: '0.4', params: { web: ['iconButtonDisabledOpacity'] } },
    { name: 'height', type: 'dimension', description: 'Высота компонента', variations: ['size'], params: { web: ['iconButtonHeight'] } },
    { name: 'backgroundColor', type: 'color', description: 'Цвет фона кнопки', variations: ['view'], params: { web: ['iconButtonBackgroundColor'] } },
    { name: 'loadingBackgroundColor', type: 'color', description: 'Цвет фона в режиме загрузки', variations: ['view'], params: { web: ['iconButtonLoadingBackgroundColor'] } },
    { name: 'iconColor', type: 'color', description: 'Цвет иконки', variations: ['view'], params: { web: ['iconButtonColor'] } },
    { name: 'spinnerColor', type: 'color', description: 'Цвет спиннера', variations: ['view'], params: { web: ['iconButtonSpinnerColor'] } },
    { name: 'focusColor', type: 'color', description: 'Цвет обводки компонента', defaultValue: 'text.default.accent', params: { web: ['iconButtonFocusColor'] } },
    { name: 'paddingStart', type: 'dimension', description: 'Отступ слева', variations: ['size'], params: { web: ['iconButtonPadding'] } },
    { name: 'minWidth', type: 'dimension', description: 'Минимальная ширина', variations: ['size'], params: { web: ['iconButtonWidth'] } },
    { name: 'spinnerSize', type: 'dimension', description: 'Размер спиннера', variations: ['size'], params: { web: ['iconButtonSpinnerSize'] } },
    { name: 'shape', type: 'shape', description: 'Форма компонента', variations: ['size', 'shape'], params: { web: ['iconButtonRadius'] } },
];
