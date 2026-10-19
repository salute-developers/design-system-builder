import { Config } from './config';
import type { Meta } from './type';

/** Стили целевого компонента, выбранные ссылкой на стиль: `variationID -> styleID`. */
export interface ResolvedStyleReference {
    config: Config;
    selections: Record<string, string>;
}

/**
 * Разворачивает ссылку на стиль другого компонента (`basic-button.xxs.default`).
 *
 * Первая часть — имя конфигурации целевого компонента, остальные — имена стилей. Имена сопоставляются с
 * вариациями конфигурации по порядку; имя, не нашедшее своей вариации по позиции, ищется среди оставшихся.
 * Вариации без указанного стиля получают стиль по умолчанию.
 */
export const resolveStyleReference = (components: Meta[], reference: string): ResolvedStyleReference | undefined => {
    const [appearanceName, ...styleNames] = reference.split('.');

    for (const meta of components) {
        const appearance = meta.sources.configs.find((item) => item.name === appearanceName);
        if (!appearance) continue;

        const config = new Config(meta, appearance.id);
        const variations = config.getVariations();
        const selections: Record<string, string> = {};
        const unmatched: string[] = [];

        styleNames.forEach((name, index) => {
            const styleID = variations[index]?.getStyles()?.find((style) => style.getName() === name)?.getID();
            if (styleID) selections[variations[index].getID()] = styleID;
            else unmatched.push(name);
        });
        for (const name of unmatched) {
            const variation = variations.find(
                (item) => !selections[item.getID()] && item.getStyles()?.some((style) => style.getName() === name),
            );
            const styleID = variation?.getStyles()?.find((style) => style.getName() === name)?.getID();
            if (variation && styleID) selections[variation.getID()] = styleID;
        }
        for (const item of config.getDefaults()) {
            if (!selections[item.getVariationID()]) selections[item.getVariationID()] = item.getStyleID();
        }

        return { config, selections };
    }
};
