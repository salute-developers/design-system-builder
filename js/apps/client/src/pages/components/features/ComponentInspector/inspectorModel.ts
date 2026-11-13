import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { humanizeName } from '../../../../utils/text';
import { Props, type ComponentAPI, type Config, type PropType, type PropUnion } from '../../../../controllers';

/** Выбор сочетания: имя вариации → id выбранного стиля (у флага — id стиля `true`). */
export type Selection = Record<string, string | boolean>;

/** Откуда взято значение свойства: правка записывается туда же. */
export type PropertySource =
    | { kind: 'invariant' }
    | { kind: 'style'; variationID: string; variationName: string; styleID: string; styleName: string }
    /** Пересечение стилей `styleIDs`: значения пишутся сразу редакторским API, а не автосохранением. */
    | { kind: 'combination'; styleIDs: string[]; label: string };

/** Источник сочетания стилей «Стилизации»: инварианты или стиль. */
type SelectionSource = Exclude<PropertySource, { kind: 'combination' }>;

/** Секции в порядке прототипа; свойства без секции уходят в дополнительные группы. */
export const INSPECTOR_SECTIONS = [
    'Size',
    'Layout',
    'Color',
    'Text',
    'Border',
    'Appearance',
    'Effects',
    'Icons',
] as const;

export type InspectorSection = (typeof INSPECTOR_SECTIONS)[number] | 'Additional';

export interface InspectorProperty {
    prop: PropUnion;
    source: PropertySource;
    section: InspectorSection;
    /** Значение задано в источнике; незаданное свойство показывается пустой строкой. */
    isSet: boolean;
    /** Свойство привязано к вариации источника; непривязанное привязывается перед первым значением. */
    linked: boolean;
}

export { humanizeName };

/**
 * Секция свойства по правилу `propertySection` прототипа: первое совпадение сверху вниз. `undefined` — свойство
 * не показывается (`value`).
 */
export const sectionOf = (type: PropType | undefined, name: string): InspectorSection | undefined => {
    if (type === 'value' || type === undefined) return undefined;
    // Иконки — отдельная секция, развёрнутая по умолчанию: в свёрнутой группе Behaviour поля легко не заметить.
    if (type === 'icon') return 'Icons';
    if (type === 'shadow' || /(shadow|blur)/i.test(name)) return 'Effects';
    if (type === 'shape' || /radius/i.test(name)) return 'Appearance';
    if (/(border|outline|stroke)/i.test(name)) return 'Border';
    if (type === 'color' || /(opacity|alpha)/i.test(name)) return 'Color';
    if (type === 'typography') return 'Text';
    if (type !== 'dimension' && type !== 'float' && type !== 'integer') return 'Additional';
    if (/(width|height)$/i.test(name)) return 'Size';
    return 'Layout';
};

/** Строки, которые прототип ставит в начало секции (`primaryOrder`); остальные — по алфавиту подписи. */
const PRIMARY_ORDER = ['width', 'height', 'padding', 'radius', 'typography', 'background', 'text', 'icon'];

export const compareProperties = (a: InspectorProperty, b: InspectorProperty) => {
    const rank = (name: string) => {
        const index = PRIMARY_ORDER.indexOf(name.toLowerCase());
        return index < 0 ? PRIMARY_ORDER.length : index;
    };
    return (
        rank(a.prop.getName()) - rank(b.prop.getName()) ||
        humanizeName(a.prop.getName()).localeCompare(humanizeName(b.prop.getName()))
    );
};

export const propertySection = (prop: PropUnion) => sectionOf(prop.getType(), prop.getName());

/** Аргументы методов `Config` для источника: инварианты — без вариации и стиля. */
export const sourceArgs = (source: PropertySource): [string | undefined, string | undefined] =>
    source.kind === 'style' ? [source.variationID, source.styleID] : [undefined, undefined];

export const sourceLabel = (source: PropertySource) =>
    source.kind === 'invariant'
        ? 'Инвариант'
        : source.kind === 'combination'
          ? source.label
          : `${source.variationName}: ${source.styleName}`;

export const sourceKey = (source: PropertySource) =>
    source.kind === 'invariant'
        ? 'invariant'
        : source.kind === 'combination'
          ? `combination:${source.styleIDs.join('+')}`
          : `${source.variationID}:${source.styleID}`;

/** Источники сочетания: инварианты, затем выбранный стиль каждой вариации в порядке «Variants». */
export const collectSources = (config: Config, selection: Selection): SelectionSource[] => {
    const styles = orderedVariations(config).flatMap((variation): SelectionSource[] => {
        const styleID = selection[variation.getName()];
        if (typeof styleID !== 'string') return [];
        const style = variation.getStyle(styleID);
        if (!style) return [];
        return [
            {
                kind: 'style',
                variationID: variation.getID(),
                variationName: variation.getName(),
                styleID: style.getID(),
                styleName: style.getName(),
            },
        ];
    });

    return [{ kind: 'invariant' }, ...styles];
};

const sourceProps = (config: Config, source: SelectionSource) =>
    source.kind === 'invariant'
        ? config.getInvariants()
        : config.getStyleByVariation(source.variationID, source.styleID)?.getProps();

/**
 * Свойства API, которые относятся к источнику: у инвариантов — без вариаций, у стиля — связанные с его вариацией.
 * Связи приходят именами вариаций (`property-variations`), поэтому вариация сравнивается и по имени, и по ID. Если
 * связей у компонента нет совсем, принадлежность свойства неизвестна: пустых строк нет ни у одного источника.
 */
const sourceApi = (api: ComponentAPI[], source: SelectionSource) => {
    if (!api.some((item) => item.variations?.length)) return [];
    return source.kind === 'invariant'
        ? api.filter((item) => !item.variations?.length)
        : api.filter((item) =>
              item.variations?.some(
                  (variation) => variation === source.variationID || variation === source.variationName,
              ),
          );
};

/** Незаданное свойство: отдельный экземпляр без значения, к модели он не привязан, пока пользователь его не заполнит. */
const emptyProp = (item: ComponentAPI, api: ComponentAPI[]) => new Props([{ id: item.id }], api).getProp(item.id);

/**
 * Строки инспектора: заданные свойства источников сочетания и пустые строки для остальных свойств API этих источников.
 * Ссылки на стили показываются только заданными.
 *
 * `showAll` добавляет стилю пустыми строками и свойства, не привязанные к его вариации (`linked: false`); у вариации
 * без привязанных свойств (новой) они видны всегда.
 */
export const collectSourceProperties = (
    config: Config,
    selection: Selection,
    api: ComponentAPI[] = [],
    showAll = false,
): InspectorProperty[] =>
    collectSources(config, selection).flatMap((source) => {
        const props = sourceProps(config, source);
        const linked = sourceApi(api, source);
        const linkedIds = new Set(linked.map((item) => item.id));
        const candidates = source.kind === 'style' && (showAll || isFreshVariation(config, api, source)) ? api : linked;
        const set = (props?.getList() ?? []).flatMap((prop): InspectorProperty[] => {
            const section = propertySection(prop);
            return section ? [{ prop, source, section, isSet: true, linked: true }] : [];
        });
        const empty = candidates.flatMap((item): InspectorProperty[] => {
            const section = sectionOf(item.type, item.name);
            // Ссылки на стили показываются только заданными; незаданную иконку можно выбрать из каталога.
            if (!section || section === 'Additional' || props?.getProp(item.id)) return [];
            const prop = emptyProp(item, api);
            return prop ? [{ prop, source, section, isSet: false, linked: linkedIds.has(item.id) }] : [];
        });
        return [...set, ...empty];
    });

/**
 * Новая вариация: к ней не привязано ни одно свойство и ни у одного её стиля нет значений. Её стилям видны все свойства
 * компонента. У старой вариации без привязок (данные без них) строки по-прежнему строятся только из заданных значений.
 */
const isFreshVariation = (config: Config, api: ComponentAPI[], source: SelectionSource) =>
    source.kind === 'style' &&
    !sourceApi(api, source).length &&
    (config.getVariation(source.variationID)?.getStyles() ?? []).every((style) => !style.getProps().getList().length);

/** В сочетании есть стиль новой вариации: для него «Показать все свойства» включено всегда. */
export const hasUnlinkedStyleSource = (config: Config, selection: Selection, api: ComponentAPI[]) =>
    collectSources(config, selection).some((source) => isFreshVariation(config, api, source));

const variationRank = (name: string) => (name === 'size' ? 0 : name === 'view' ? 1 : 2);

/** Вариации в порядке «Variants»: `size`, `view`, затем остальные в порядке модели. */
export const orderedVariations = (config: Config) =>
    config
        .getVariations()
        .map((variation, index) => ({ variation, index }))
        .sort(
            (a, b) => variationRank(a.variation.getName()) - variationRank(b.variation.getName()) || a.index - b.index,
        )
        .map(({ variation }) => variation);

/** Заголовок сочетания: «Chip M Default». `size` пишется заглавными, остальные стили — с заглавной буквы, флаги не пишутся. */
export const combinationTitle = (config: Config, selection: Selection) => {
    const parts = orderedVariations(config).flatMap((variation) => {
        if (variation.isFlag()) return [];
        const styleID = selection[variation.getName()];
        const name = typeof styleID === 'string' ? variation.getStyle(styleID)?.getName() : undefined;
        if (!name) return [];
        return [variation.getName() === 'size' ? name.toUpperCase() : upperFirstLetter(name)];
    });

    return [config.getName(), ...parts].join(' ');
};

/** Стиль сочетания после удаления выбранного: стиль по умолчанию вариации, иначе первый, иначе вариации нет. */
export const fallbackStyle = (config: Config, variationID: string) => {
    const variation = config.getVariation(variationID);
    const defaultID = config
        .getDefaults()
        .find((item) => item.getVariationID() === variationID)
        ?.getStyleID();
    const styles = variation?.getStyles() ?? [];

    return styles.find((style) => style.getID() === defaultID)?.getID() ?? styles[0]?.getID();
};

export const isDefaultStyle = (config: Config, variationID: string, styleID?: string) =>
    Boolean(
        styleID &&
        config.getDefaults().some((item) => item.getVariationID() === variationID && item.getStyleID() === styleID),
    );

/** Подпись пересечения: `size: l · shape: pilled` в порядке вариаций модели. */
export const combinationLabel = (config: Config, styleIDs: readonly string[]) =>
    config
        .getVariations()
        .flatMap((variation) =>
            (variation.getStyles() ?? [])
                .filter((style) => styleIDs.includes(style.getID()))
                .map((style) => `${variation.getName()}: ${style.getName()}`),
        )
        .join(' · ');

/**
 * Строки пересечения: заданные значения сочетания и пустые строки для свойств его вариаций — привязанных к ним или
 * заданных хотя бы у одного их стиля. Пустая строка значит, что действует значение обычного стиля.
 */
export const collectCombinationProperties = (
    config: Config,
    styleIDs: string[],
    api: ComponentAPI[] = [],
): InspectorProperty[] => {
    const source: PropertySource = { kind: 'combination', styleIDs, label: combinationLabel(config, styleIDs) };
    const variations = config
        .getVariations()
        .filter((variation) => variation.getStyles()?.some((style) => styleIDs.includes(style.getID())));
    // Связи свойств приходят именами вариаций, поэтому сравниваются и ID, и имена.
    const variationKeys = variations.flatMap((variation) => [variation.getID(), variation.getName()]);
    const styleProps = new Set(
        variations.flatMap((variation) =>
            (variation.getStyles() ?? []).flatMap((style) =>
                style
                    .getProps()
                    .getList()
                    .map((prop) => prop.getID()),
            ),
        ),
    );
    const props = config
        .getCombinations()
        .find(
            (item) => item.styleIDs.length === styleIDs.length && item.styleIDs.every((id) => styleIDs.includes(id)),
        )?.props;
    const set = (props?.getList() ?? []).flatMap((prop): InspectorProperty[] => {
        const section = propertySection(prop);
        return section ? [{ prop, source, section, isSet: true, linked: true }] : [];
    });
    const empty = api
        .filter((item) => styleProps.has(item.id) || item.variations?.some((key) => variationKeys.includes(key)))
        .flatMap((item): InspectorProperty[] => {
            const section = sectionOf(item.type, item.name);
            if (!section || section === 'Additional' || props?.getProp(item.id)) return [];
            const prop = emptyProp(item, api);
            return prop ? [{ prop, source, section, isSet: false, linked: true }] : [];
        });
    return [...set, ...empty];
};
