import type { Config } from '../../../../controllers';

export const modeList = [
    {
        label: 'Тёмный',
        value: 'dark',
    },
    {
        label: 'Светлый',
        value: 'light',
    },
];

/** Превью, с которым раздел компонента открывается из вкладки «Доступность» цветовых токенов. */
export interface ComponentPreviewRequest {
    variation: string;
    style: string;
    mode: string;
}

export const componentPreviewRequest = (state: unknown): ComponentPreviewRequest | undefined => {
    const preview = (state as { preview?: Partial<ComponentPreviewRequest> } | null)?.preview;
    if (typeof preview?.variation !== 'string' || typeof preview.style !== 'string' || typeof preview.mode !== 'string') {
        return undefined;
    }
    return { variation: preview.variation, style: preview.style, mode: preview.mode };
};

/** Вариация и стиль превью по именам: идентификаторы для выбора и аргумент компонента. */
export const resolveComponentPreview = (config: Config, preview: ComponentPreviewRequest) => {
    const variation = config.getVariations().find((item) => item.getName() === preview.variation);
    const style = variation?.getStyles()?.find((item) => item.getName() === preview.style);
    if (!variation || !style) {
        return undefined;
    }
    return { variationID: variation.getID(), variationName: variation.getName(), styleID: style.getID() };
};
