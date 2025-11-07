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

    return defaults;
};

const getDefaults = (config?: Config, args?: Record<string, string | boolean>) => {
    if (config === undefined) {
        return { variationID: undefined, styleID: undefined };
    }

    const entries = Object.entries(args as Record<string, string>);

    if (entries.length === 0) {
        return { variationID: undefined, styleID: undefined };
    }

    const [variation, value] = entries[0];

    const variationID = config
        .getVariations()
        .find((item) => item.getName() === variation)
        ?.getID();

    return { variationID, styleID: value };
};

export const useVariationAndStyle = (config?: Config) => {
    const [componentProps, setComponentProps] = useState({});
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

    return [selectedVariation, setSelectedVariation, selectedStyle, setSelectedStyle] as const;
};
