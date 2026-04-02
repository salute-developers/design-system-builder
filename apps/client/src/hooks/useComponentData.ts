import { useEffect, useState } from 'react';

import { Config } from '../controllers';

// TODO: перенести в утилиты?
const getDefaultProps = (config: Config) => {
    const defaultVariations = config.getDefaults();

    const defaults: Record<string, string | boolean> = {};

    defaultVariations.forEach((item) => {
        const variation = item.getVariation();
        const styleID = item.getStyleID();

        defaults[variation] = styleID;
    });

    if (defaultVariations.length) {
        return defaults;
    }

    config.getVariations().forEach((variation) => {
        const firstStyle = variation.getStyles()?.[0];

        if (firstStyle) {
            defaults[variation.getName()] = firstStyle.getID();
        }
    });

    return defaults;
};

const getDefaults = (config?: Config, args?: Record<string, string | boolean>) => {
    if (config === undefined) {
        return { variationID: undefined, styleID: undefined };
    }

    const variations = config.getVariations();
    const variationNames = new Set(variations.map((item) => item.getName()));
    const entries = Object.entries(args as Record<string, string>).filter(([key]) => variationNames.has(key));

    if (entries.length === 0 && variations.length > 0) {
        const firstVariation = variations[0];
        const firstStyle = firstVariation.getStyles()?.[0];

        return { variationID: firstVariation.getID(), styleID: firstStyle?.getID() };
    }

    if (entries.length === 0) {
        return { variationID: undefined, styleID: undefined };
    }

    const [variation, value] = entries[0];

    const variationID = variations.find((item) => item.getName() === variation)?.getID();

    return { variationID, styleID: value };
};

export const useComponentData = (config?: Config) => {
    const [componentProps, setComponentProps] = useState<Record<string, string | boolean>>({});
    const { variationID, styleID } = getDefaults(config, componentProps);

    const [selectedVariation, setSelectedVariation] = useState<undefined | string>(variationID);
    const [selectedStyle, setSelectedStyle] = useState<undefined | string>(styleID);

    useEffect(() => {
        if (config) {
            setComponentProps((prev) => ({ ...prev, ...getDefaultProps(config) }));
        }
    }, [config]);

    useEffect(() => {
        setSelectedVariation(variationID);
        setSelectedStyle(styleID);
    }, [variationID, styleID]);

    return [
        selectedVariation,
        setSelectedVariation,
        selectedStyle,
        setSelectedStyle,
        componentProps,
        setComponentProps,
    ] as const;
};
