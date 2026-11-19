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
    'Nested styles',
] as const;

export type InspectorSection = (typeof INSPECTOR_SECTIONS)[number] | 'Additional';

/** Секции, чьи свойства показываются только заданными: пустые строки им не строятся. */
export const isSetOnlySection = (section: InspectorSection) => section === 'Additional' || section === 'Nested styles';

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
 * не показывается (тип неизвестен). Сырой CSS (`value`) раскладывается по имени: цвета — в Color, ширина и высота —
 * в Size, остальное — в Layout.
 */
export const sectionOf = (type: PropType | undefined, name: string): InspectorSection | undefined => {
    if (type === undefined) return undefined;
    // Иконки — отдельная секция, развёрнутая по умолчанию: в свёрнутой группе Behaviour поля легко не заметить.
    if (type === 'icon') return 'Icons';
    // Стиль вложенного компонента: ссылка на оформление другого компонента, отдельная секция.
    if (type === 'component_style') return 'Nested styles';
    if (type === 'shadow' || /(shadow|blur)/i.test(name)) return 'Effects';
    if (type === 'shape' || /radius/i.test(name)) return 'Appearance';
    if (/(border|outline|stroke)/i.test(name)) return 'Border';
    if (type === 'color' || /(opacity|alpha)/i.test(name) || (type === 'value' && /(color|background)/i.test(name))) {
        return 'Color';
    }
    if (type === 'typography') return 'Text';
    if (type !== 'dimension' && type !== 'float' && type !== 'integer' && type !== 'value') return 'Additional';
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

/** Выбранные стили в порядке «Variants»: вариация без выбора («не выбрано») и выключенный флаг не входят. */
const selectedStyles = (config: Config, selection: Selection) =>
    orderedVariations(config).flatMap((variation) => {
        const styleID = selection[variation.getName()];
        const style = typeof styleID === 'string' ? variation.getStyle(styleID) : undefined;
        return style ? [{ variation, style }] : [];
    });

/**
 * Источник правки по выбору в «Variants»: ничего не выбрано — инвариант, одно значение — его стиль, два и больше —
 * пересечение выбранных стилей.
 */
export const editSource = (config: Config, selection: Selection): PropertySource => {
    const styles = selectedStyles(config, selection);
    if (!styles.length) return { kind: 'invariant' };
    if (styles.length === 1) {
        const [{ variation, style }] = styles;
        return {
            kind: 'style',
            variationID: variation.getID(),
            variationName: variation.getName(),
            styleID: style.getID(),
            styleName: style.getName(),
        };
    }
    // Подпись — в порядке «Variants», как пользователь выбирал стили: `size: xs · view: accent`.
    return {
        kind: 'combination',
        styleIDs: styles.map(({ style }) => style.getID()),
        label: styles.map(({ variation, style }) => `${variation.getName()}: ${style.getName()}`).join(' · '),
    };
};

/** Значения источника: инварианты, свойства стиля или пересечения ровно этих стилей. */
const sourceProps = (config: Config, source: PropertySource) => {
    if (source.kind === 'invariant') return config.getInvariants();
    if (source.kind === 'style') return config.getStyleByVariation(source.variationID, source.styleID)?.getProps();
    return config
        .getCombinations()
        .find(
            (item) =>
                item.styleIDs.length === source.styleIDs.length &&
                item.styleIDs.every((id) => source.styleIDs.includes(id)),
        )?.props;
};

/** Свойство API привязано к вариации стиля: связи приходят именами вариаций, поэтому сравниваются и имя, и ID. */
const isLinked = (item: ComponentAPI, source: PropertySource) =>
    source.kind !== 'style' ||
    Boolean(
        item.variations?.some((variation) => variation === source.variationID || variation === source.variationName),
    );

/** Незаданное свойство: отдельный экземпляр без значения, к модели он не привязан, пока пользователь его не заполнит. */
const emptyProp = (item: ComponentAPI, api: ComponentAPI[]) => new Props([{ id: item.id }], api).getProp(item.id);

/**
 * Строки инспектора для источника правки: одна строка на свойство. Список одинаковый для любого источника — все
 * свойства API компонента (кроме `value`); заданные берут значение источника, остальные показываются пустыми. Ссылки
 * на стили показываются только заданными. Непривязанное к вариации свойство стиля привязывается перед первым значением.
 */
export const collectProperties = (
    config: Config,
    selection: Selection,
    api: ComponentAPI[] = [],
): InspectorProperty[] => {
    const source = editSource(config, selection);
    const props = sourceProps(config, source);
    const byId = new Map(api.map((item) => [item.id, item]));
    const set = (props?.getList() ?? []).flatMap((prop): InspectorProperty[] => {
        const section = propertySection(prop);
        const item = byId.get(prop.getID());
        return section ? [{ prop, source, section, isSet: true, linked: !item || isLinked(item, source) }] : [];
    });
    const empty = api.flatMap((item): InspectorProperty[] => {
        const section = sectionOf(item.type, item.name);
        if (!section || isSetOnlySection(section) || props?.getProp(item.id)) return [];
        const prop = emptyProp(item, api);
        return prop ? [{ prop, source, section, isSet: false, linked: isLinked(item, source) }] : [];
    });
    return [...set, ...empty];
};

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
