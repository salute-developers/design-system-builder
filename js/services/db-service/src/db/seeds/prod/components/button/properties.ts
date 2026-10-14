import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'shape', type: 'shape', description: 'Форма кнопки', variations: ['size', 'shape'], params: { web: ['buttonRadius'] } },
    { name: 'spinnerColor', type: 'color', description: 'Цвет индикатора загрузки', variations: ['view'], params: { web: ['buttonSpinnerColor'] } },
    { name: 'valueColor', type: 'color', description: 'Цвет дополнительного текста', variations: ['view'], params: { web: ['buttonValueColor'] } },
    { name: 'focusColor', type: 'color', description: 'Цвет обводки компонента', params: { web: ['buttonFocusColor'] } },
    { name: 'disableAlpha', type: 'float', description: 'Значение прозрачности в отключенном варианте', params: { web: ['buttonDisabledOpacity'] } },
    { name: 'height', type: 'dimension', description: 'Высота кнопки', variations: ['size'], params: { web: ['buttonHeight'] } },
    { name: 'paddingEnd', type: 'dimension', description: 'Отступ от контента до конца', variations: ['size'], params: { web: ['buttonPadding'] } },
    { name: 'minWidth', type: 'dimension', description: 'Минимальная ширина кнопки', variations: ['size'], params: { web: ['buttonWidth'] } },
    { name: 'spinnerSize', type: 'dimension', description: 'Размер индикатора загрузки', variations: ['size'], params: { web: ['buttonSpinnerSize'] } },
    { name: 'iconMargin', type: 'dimension', description: 'Отступ от иконки до текста', variations: ['size'], params: { web: ['buttonLeftContentMargin', 'buttonRightContentMargin'] } },
    { name: 'valueMargin', type: 'dimension', description: 'Отступ от label до value', variations: ['size'], params: { web: ['buttonValueMargin'] } },
    { name: 'labelStyle', type: 'typography', description: 'Стиль основного текста', variations: ['size'], params: { web: ['buttonFontFamily', 'buttonFontSize', 'buttonFontStyle', 'buttonFontWeight', 'buttonLetterSpacing', 'buttonLineHeight'] } },
    { name: 'backgroundColor', type: 'color', description: 'Цвет фона кнопки', variations: ['view'], params: { web: ['buttonBackgroundColor'] } },
    { name: 'loadingBackgroundColor', type: 'color', description: 'Цвет фона кнопки при загрузки', variations: ['view'], params: { web: ['buttonLoadingBackgroundColor'] } },
    { name: 'labelColor', type: 'color', description: 'Цвет основного текста', variations: ['view'], params: { web: ['buttonColor'] } },
];
