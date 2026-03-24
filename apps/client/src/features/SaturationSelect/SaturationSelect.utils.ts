import { textParagraph, textPrimary, textTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

export const DESCRIPTION_WIDTH = 128;

export const DEFAULT_COLOR_SATURATION_SIZE = 40;

export const HOVERED_COLOR_SATURATION_SIZE = 48;

export const HOVERED_COLOR_SATURATION_SIBLING_SIZE = 36;

export const HOVERED_COLOR_SATURATION_REST_SIZE = 32;

export const getItemSizeAndColor = (hoveredIndex: number | null, index: number): [number, string] => {
    if (hoveredIndex === index) {
        return [HOVERED_COLOR_SATURATION_SIZE, textPrimary];
    }

    if (hoveredIndex === index - 1 || hoveredIndex === index + 1) {
        return [HOVERED_COLOR_SATURATION_SIBLING_SIZE, textParagraph];
    }

    if (hoveredIndex === null) {
        return [DEFAULT_COLOR_SATURATION_SIZE, textPrimary];
    }

    return [HOVERED_COLOR_SATURATION_REST_SIZE, textTertiary];
};
