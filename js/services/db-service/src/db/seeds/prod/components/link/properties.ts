import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'textColorVisited', type: 'color', description: 'Цвет текста посещённой ссылки', variations: ['view'], params: { xml: ['contentColorVisited'], compose: ['contentColorVisited'], ios: ['contentColorVisited'], web: ['linkColorVisited'] } },
    { name: 'underlineBorderWidth', type: 'dimension', description: 'Толщина подчеркивания текста ссылки', variations: ['view'], params: { xml: ['underlineBorderWidth'], compose: ['underlineBorderWidth'], ios: ['underlineBorderWidth'], web: ['linkUnderlineBorder'] } },
    { name: 'focusColor', type: 'color', description: 'Цвет обводки компонента', params: { web: ['linkColorFocus'] } },
    { name: 'disableAlpha', type: 'float', description: 'Значение прозрачности в отключенном варианте', params: { xml: ['disableAlpha'], compose: ['disableAlpha'], ios: ['disableAlpha'], web: ['linkDisabledOpacity'] } },
    { name: 'textStyle', type: 'typography', description: 'Стиль текста ссылки', variations: ['size'], params: { xml: ['android:minHeight'], compose: ['height'], ios: ['height'], web: ['linkFontFamily', 'linkFontSize', 'linkFontStyle', 'linkFontWeight', 'linkLetterSpacing', 'linkLineHeight'] } },
    { name: 'textColor', type: 'color', description: 'Цвет текста ссылки', variations: ['view'], params: { xml: ['contentColor'], compose: ['contentColor'], ios: ['contentColor'], web: ['linkColor'] } },
];
