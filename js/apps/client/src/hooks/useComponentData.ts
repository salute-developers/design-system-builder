import { useEffect, useState } from 'react';

import { Config } from '../controllers';

// TODO: перенести в утилиты?
export const getDefaultProps = (config: Config) => {
    const defaultVariations = config.getDefaults();
    const defaults: Record<string, string | boolean> = {};

    defaultVariations.forEach((item) => {
        defaults[item.getVariation()] = item.getStyleID();
    });

    // Для web при заданных стилях по умолчанию остальные вариации не выбираются, как и раньше.
    if (defaultVariations.length && config.getPlatform() !== 'compose') {
        return defaults;
    }

    // Вариация без стиля по умолчанию (например, `view` у `TabBar`) получает первый стиль: от него зависят значения
    // сочетаний стилей, и без него вложенные стили айтемов не попадают в превью, пока вкладку вариации не откроют.
    // Флаг без значения по умолчанию остаётся выключенным: его выключенное состояние — отсутствие аргумента.
    config.getVariations().forEach((variation) => {
        if (defaults[variation.getName()] !== undefined || (defaultVariations.length && variation.isFlag())) {
            return;
        }

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

    if (entries.length === 0) {
        return { variationID: undefined, styleID: undefined };
    }

    const [variation, value] = entries[0];
    const variationID = variations.find((item) => item.getName() === variation)?.getID();

    return { variationID, styleID: value };
};

/** Выбор вариаций редактора: стили по умолчанию при открытии компонента. Аргументы story описывает плагин превью. */
export const useComponentData = (config?: Config) => {
    const [componentProps, setComponentProps] = useState<Record<string, string | boolean>>({});
    const { variationID, styleID } = getDefaults(config, componentProps);

    const [selectedVariation, setSelectedVariation] = useState<undefined | string>(variationID);
    const [selectedStyle, setSelectedStyle] = useState<undefined | string>(styleID);

    useEffect(() => {
        if (!config) {
            return;
        }

        const defaults = getDefaultProps(config);
        setComponentProps(defaults);

        const newDefaults = getDefaults(config, defaults);
        setSelectedVariation(newDefaults.variationID);
        setSelectedStyle(newDefaults.styleID);
    }, [config]);

    return [
        selectedVariation,
        setSelectedVariation,
        selectedStyle,
        setSelectedStyle,
        componentProps,
        setComponentProps,
    ] as const;
};
