import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'textColorVisited', type: 'color', description: 'Цвет текста посещённой ссылки', variations: ['view'], params: { web: ['linkColorVisited'] } },
    { name: 'underlineBorderWidth', type: 'dimension', description: 'Толщина подчеркивания текста ссылки', variations: ['view'], params: { web: ['linkUnderlineBorder'] } },
    { name: 'focusColor', type: 'color', description: 'Цвет обводки компонента', params: { web: ['linkColorFocus'] } },
    { name: 'disableAlpha', type: 'float', description: 'Значение прозрачности в отключенном варианте', params: { web: ['linkDisabledOpacity'] } },
    { name: 'textStyle', type: 'typography', description: 'Стиль текста ссылки', variations: ['size'], params: { web: ['linkFontFamily', 'linkFontSize', 'linkFontStyle', 'linkFontWeight', 'linkLetterSpacing', 'linkLineHeight'] } },
    { name: 'textColor', type: 'color', description: 'Цвет текста ссылки', variations: ['view'], params: { web: ['linkColor'] } },
];
