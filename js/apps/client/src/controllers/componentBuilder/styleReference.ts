import { Config } from './config';
import type { ComponentAPI, ComponentConfig, Meta } from './type';

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
            const styleID = variations[index]
                ?.getStyles()
                ?.find((style) => style.getName() === name)
                ?.getID();
            if (styleID) selections[variations[index].getID()] = styleID;
            else unmatched.push(name);
        });
        for (const name of unmatched) {
            const variation = variations.find(
                (item) => !selections[item.getID()] && item.getStyles()?.some((style) => style.getName() === name),
            );
            const styleID = variation
                ?.getStyles()
                ?.find((style) => style.getName() === name)
                ?.getID();
            if (variation && styleID) selections[variation.getID()] = styleID;
        }
        for (const item of config.getDefaults()) {
            if (!selections[item.getVariationID()]) selections[item.getVariationID()] = item.getStyleID();
        }

        return { config, selections };
    }
};

/** Оформление целевого компонента, доступное для выбора ссылкой на стиль. */
export interface StyleReferenceTarget {
    componentName: string;
    appearanceId?: string;
    appearanceName: string;
    /** Конфигурация цели прочитана: оси и стили доступны; иначе её нужно догрузить. */
    loaded: boolean;
}

/** Ссылка в формате операции записи `ds-service`: целевое оформление и выбранные стили его вариаций. */
export interface StyleReferenceInput {
    targetAppearanceId: string;
    styleIds: string[];
}

/**
 * Оформления Compose-компонентов для выбора: имена берутся из прочитанных конфигураций, а у компонентов,
 * известных только по индексу, — из кратких имён оформлений. Собственное оформление `excludeAppearanceId` исключается.
 */
export const listStyleReferenceTargets = (components: Meta[], excludeAppearanceId?: string): StyleReferenceTarget[] => {
    // Строка ссылки несёт только имя оформления, а `resolveStyleReference` берёт первое одноимённое: повторное имя
    // у другого компонента выбором не выразить, поэтому такая цель не предлагается; имя собственного оформления
    // занято так же, чтобы одноимённая цель не развернулась в него.
    const seen = new Set<string>(
        components.flatMap((meta) =>
            meta.sources.configs.filter((item) => item.id === excludeAppearanceId).map((item) => item.name),
        ),
    );
    return components.flatMap((meta): StyleReferenceTarget[] => {
        const configs = meta.sources.configs;
        if (configs.length > 0) {
            return configs
                .filter((item) => item.id !== excludeAppearanceId && !seen.has(item.name) && seen.add(item.name))
                .map((item) => ({
                    componentName: meta.name,
                    appearanceId: item.id,
                    appearanceName: item.name,
                    loaded: true,
                }));
        }
        return (meta.serverBinding?.appearanceNames ?? [])
            .filter((appearanceName) => !seen.has(appearanceName) && seen.add(appearanceName))
            .map((appearanceName) => ({
                componentName: meta.name,
                appearanceName,
                loaded: false,
            }));
    });
};

/** Имя оформления и имена стилей из строки ссылки. */
export const parseStyleReference = (reference: string) => {
    const [appearanceName = '', ...styleNames] = reference.split('.');

    return { appearanceName, styleNames };
};

/**
 * Собирает строку ссылки `оформление.стиль1.стиль2`: имена стилей идут в порядке вариаций оформления.
 * Вариации без выбранного стиля пропускаются.
 */
export const buildStyleReferenceValue = (config: Config, selections: Record<string, string>): string => {
    const styleNames = config.getVariations().flatMap((variation) => {
        const styleID = selections[variation.getID()];
        const name = variation
            .getStyles()
            ?.find((style) => style.getID() === styleID)
            ?.getName();

        return name ? [name] : [];
    });

    return [config.getAppearanceName(), ...styleNames].join('.');
};

/** Выбор в формате операции записи: по одному стилю каждой вариации в порядке вариаций. */
export const toStyleReferenceInput = (resolved: ResolvedStyleReference): StyleReferenceInput | undefined => {
    const targetAppearanceId = resolved.config.getConfigurationId();
    if (!targetAppearanceId) return undefined;
    const styleIds = resolved.config.getVariations().flatMap((variation) => {
        const styleID = resolved.selections[variation.getID()];

        return styleID ? [styleID] : [];
    });

    return { targetAppearanceId, styleIds };
};

const REFERENCE_ERRORS: Record<string, string> = {
    reference_target_not_found: 'Выбранное оформление вложенного компонента не найдено',
    reference_invalid_styles: 'Выбранные стили не относятся к этому оформлению',
    reference_cycle: 'Ссылка на стиль создаёт цикл: вложенный компонент уже ссылается на этот',
    reference_too_deep: 'Цепочка вложенных стилей слишком длинная',
};

/** Сообщение для кода отказа проверки ссылки; для других кодов — `undefined`. */
export const styleReferenceErrorMessage = (code: unknown): string | undefined =>
    typeof code === 'string' ? REFERENCE_ERRORS[code] : undefined;

/**
 * Значения свойств `component_style` в конфигурации: инварианты, стили вариаций и сочетания. Нужны, чтобы перед
 * повтором отложенной правки догрузить оформления, на которые она ссылается.
 */
export const collectStyleReferenceValues = (config: ComponentConfig, api: ComponentAPI[]): string[] => {
    const ids = new Set(api.filter((property) => property.type === 'component_style').map((property) => property.id));
    if (ids.size === 0) return [];
    const props = [
        ...(config.invariantProps ?? []),
        ...(config.variations ?? []).flatMap((variation) =>
            (variation.styles ?? []).flatMap((style) => style.props ?? []),
        ),
        ...(config.combinations ?? []).flatMap((combination) => combination.props ?? []),
    ];

    return [
        ...new Set(
            props.flatMap((prop) =>
                ids.has(prop.id) && typeof prop.value === 'string' && prop.value !== '' ? [prop.value] : [],
            ),
        ),
    ];
};

/**
 * Имя Compose-компонента, чьё оформление названо в ссылке, если конфигурации этого компонента ещё не загружены;
 * `undefined`, когда ссылка уже разворачивается или оформление неизвестно.
 */
export const findUnloadedStyleReferenceTarget = (components: Meta[], reference: string): string | undefined => {
    if (resolveStyleReference(components, reference)) return undefined;
    const { appearanceName } = parseStyleReference(reference);

    return components.find((meta) => meta.serverBinding?.appearanceNames?.includes(appearanceName))?.name;
};
