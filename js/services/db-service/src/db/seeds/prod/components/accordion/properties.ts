import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'accordionGap', type: 'dimension', variations: ['view'], params: { web: ['accordionGap'] } },
    { name: 'accordionWidth', type: 'dimension', variations: ['view'], params: { web: ['accordionWidth'] } },
    { name: 'accordionItemPaddingVertical', type: 'dimension', variations: ['size'], params: { web: ['accordionItemPaddingVertical'] } },
    { name: 'accordionItemPaddingHorizontal', type: 'dimension', variations: ['size'], params: { web: ['accordionItemPaddingHorizontal'] } },
    { name: 'accordionItemGap', type: 'dimension', variations: ['view', 'size'], params: { web: ['accordionItemGap'] } },
    { name: 'accordionItemIconSize', type: 'dimension', variations: ['size'], params: { web: ['accordionItemIconSize'] } },
    { name: 'accordionItemPadding', type: 'value', variations: ['size', 'view'], params: { web: ['accordionItemPadding'] } },
    { name: 'accordionItemBackground', type: 'color', variations: ['view'], params: { web: ['accordionItemBackground'] } },
    { name: 'accordionItemTitleColor', type: 'color', variations: ['view'], params: { web: ['accordionItemTitleColor'] } },
    { name: 'accordionItemTextColor', type: 'color', variations: ['view'], params: { web: ['accordionItemTextColor'] } },
    { name: 'accordionItemIconColor', type: 'color', variations: ['view'], params: { web: ['accordionItemIconColor'] } },
    { name: 'accordionItemFocus', type: 'color', variations: ['view'], params: { web: ['accordionItemFocus'] } },
    { name: 'accordionBackground', type: 'color', variations: ['view'], params: { web: ['accordionBackground'] } },
    { name: 'accordionItemBorderBottom', type: 'value', variations: ['view'], params: { web: ['accordionItemBorderBottom'] } },
    { name: 'accordionItemPaddingHorizontalLeft', type: 'value', variations: ['size', 'view'], params: { web: ['accordionItemPaddingHorizontalLeft'] } },
    { name: 'accordionItemTitleStyle', type: 'typography', variations: ['size'], params: { web: ['accordionItemTitleFontFamily', 'accordionItemTitleFontSize', 'accordionItemTitleFontWeight', 'accordionItemTitleLetterSpacing', 'accordionItemTitleLineHeight', 'accordionItemTitleFontStyle'] } },
    { name: 'accordionItemTextStyle', type: 'typography', variations: ['size'], params: { web: ['accordionItemTextFontFamily', 'accordionItemTextFontStyle', 'accordionItemTextFontSize', 'accordionItemTextFontWeight', 'accordionItemTextLetterSpacing', 'accordionItemTextLineHeight'] } },
    { name: 'accordionItemViewBorderRadius', type: 'dimension', variations: ['view'], params: { web: ['accordionItemViewBorderRadius'] } },
    { name: 'accordionItemBorderRadius', type: 'dimension', variations: ['size'], params: { web: ['accordionItemBorderRadius'] } },
];
