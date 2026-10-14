import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'verticalPadding', type: 'dimension', description: 'Отступ лейбла и описания от верхнего края', variations: ['size'], params: { web: ['contentTopOffset'] } },
    { name: 'disableAlpha', type: 'float', description: 'Значение прозрачности в отключенном варианте', params: { web: ['disabledOpacity'] } },
    { name: 'margin', type: 'dimension', description: 'Внешний отступ', variations: ['size'], params: { web: ['margin'] } },
    { name: 'togglePadding', type: 'dimension', description: 'Внутренний отступ тоггла', variations: ['size'], params: { web: ['triggerPadding'] } },
    { name: 'toggleShape', type: 'shape', description: 'Скругление тоггла', variations: ['size'], params: { web: ['triggerBorderRadius'] } },
    { name: 'toggleBorderWidth', type: 'dimension', description: 'Толщина бордера тоггла', variations: ['size'], params: { web: ['triggerBorderWidth'] } },
    { name: 'focusColor', type: 'color', description: 'Цвет обводки компонента', params: { web: ['focusColor'] } },
    { name: 'descriptionColor', type: 'color', description: 'Цвет описания', variations: ['view'], params: { web: ['descriptionColor'] } },
    { name: 'toggleHeight', type: 'dimension', description: 'Высота тоггла', variations: ['size'], params: { web: ['triggerSize'] } },
    { name: 'descriptionPadding', type: 'dimension', description: 'Отступ между лейблом и описанием', variations: ['size'], params: { web: ['descriptionMarginTop'] } },
    { name: 'labelStyle', type: 'typography', description: 'Стиль подписи', variations: ['size'], params: { web: ['labelFontFamily', 'labelFontSize', 'labelFontStyle', 'labelFontWeight', 'labelLetterSpacing', 'labelLineHeight'] } },
    { name: 'descriptionStyle', type: 'typography', description: 'Стиль описания', variations: ['size'], params: { web: ['descriptionFontFamily', 'descriptionFontSize', 'descriptionFontStyle', 'descriptionFontWeight', 'descriptionLetterSpacing', 'descriptionLineHeight'] } },
    { name: 'toggleCheckedBackgroundColor', type: 'color', description: 'Цвет фона тоггла', variations: ['view'], params: { web: ['fillColor'] } },
    { name: 'horizontalPadding', type: 'dimension', description: 'Горизонтальный отступ между тогглом и текстом', variations: ['size'], params: { web: ['contentLeftOffset'] } },
    { name: 'iconColor', type: 'color', description: 'Цвет иконки', variations: ['view'], params: { web: ['iconColor'] } },
    { name: 'labelColor', type: 'color', description: 'Цвет подписи', variations: ['view'], params: { web: ['labelColor'] } },
    { name: 'toggleBackgroundColor', type: 'color', description: 'Цвет фона тоггла в невыбранном варианте', variations: ['view'], params: { web: ['triggerBackgroundColor'] } },
    { name: 'toggleCheckedBorderColor', type: 'color', description: 'Цвет бордера тоггла', variations: ['view'], params: { web: ['triggerBorderCheckedColor'] } },
    { name: 'toggleBorderColor', type: 'color', description: 'Цвет бордера тоггла в невыбранном варианте', variations: ['view'], params: { web: ['triggerBorderColor'] } },
];
