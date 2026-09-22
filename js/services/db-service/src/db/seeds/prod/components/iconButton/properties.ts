import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'loadingAlpha', type: 'float', description: 'Значение прозрачности в режиме загрузки', defaultValue: '0', params: { xml: ['loadingAlpha'], compose: ['loadingAlpha'], ios: ['loadingAlpha'] } },
    { name: 'disableAlpha', type: 'float', description: 'Значение прозрачности в отключенном варианте', defaultValue: '0.4', params: { xml: ['disableAlpha'], compose: ['disableAlpha'], ios: ['disableAlpha'], web: ['iconButtonDisabledOpacity'] } },
    { name: 'height', type: 'dimension', description: 'Высота компонента', variations: ['size'], params: { xml: ['android:minHeight'], compose: ['height'], ios: ['height'], web: ['iconButtonHeight'] } },
    { name: 'backgroundColor', type: 'color', description: 'Цвет фона кнопки', variations: ['view'], params: { xml: ['backgroundTint'], compose: ['backgroundColor'], ios: ['backgroundColor'], web: ['iconButtonBackgroundColor'] } },
    { name: 'loadingBackgroundColor', type: 'color', description: 'Цвет фона в режиме загрузки', variations: ['view'], params: { web: ['iconButtonLoadingBackgroundColor'] } },
    { name: 'iconColor', type: 'color', description: 'Цвет иконки', variations: ['view'], params: { xml: ['sd_iconTint'], compose: ['iconColor'], ios: ['iconColor'], web: ['iconButtonColor'] } },
    { name: 'spinnerColor', type: 'color', description: 'Цвет спиннера', variations: ['view'], params: { xml: ['sd_spinnerTint'], compose: ['spinnerColor'], ios: ['spinnerColor'], web: ['iconButtonSpinnerColor'] } },
    { name: 'focusColor', type: 'color', description: 'Цвет обводки компонента', defaultValue: 'text.default.accent', params: { web: ['iconButtonFocusColor'] } },
    { name: 'paddingStart', type: 'dimension', description: 'Отступ слева', variations: ['size'], params: { xml: ['android:paddingStart'], compose: ['paddings'], ios: ['paddings'], web: ['iconButtonPadding'] } },
    { name: 'paddingEnd', type: 'dimension', description: 'Отступ справа', variations: ['size'], params: { xml: ['paddingEnd'], compose: ['paddings'], ios: ['paddings'], web: ['iconButtonPadding'] } },
    { name: 'minWidth', type: 'dimension', description: 'Минимальная ширина', variations: ['size'], params: { xml: ['android:minWidth'], compose: ['minWidth'], web: ['iconButtonWidth'] } },
    { name: 'iconSize', type: 'dimension', description: 'Размер иконки', variations: ['size'], params: { xml: ['sd_iconSize'], compose: ['iconSize'], ios: ['iconSize'] } },
    { name: 'spinnerSize', type: 'dimension', description: 'Размер спиннера', variations: ['size'], params: { xml: ['sd_spinnerSize'], compose: ['spinnerSize'], ios: ['spinnerSize'], web: ['iconButtonSpinnerSize'] } },
    { name: 'spinnerStrokeWidth', type: 'dimension', description: 'Толщина линии спиннера', variations: ['size'], params: { xml: ['sd_spinnerStrokeWidth'], compose: ['spinnerStrokeWidth'], ios: ['spinnerStrokeWidth'] } },
    { name: 'shape', type: 'shape', description: 'Форма компонента', variations: ['size', 'shape'], params: { xml: ['sd_shapeAppearance'], compose: ['shape'], ios: ['cornerRadius'], web: ['iconButtonRadius'] } },
];
