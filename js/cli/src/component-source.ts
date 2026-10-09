import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
    ComponentAPI,
    Config,
    Meta,
    PropConfig,
    PropType,
    StyleConfig,
} from '../../services/generator/app/componentBuilder/type.ts';

/**
 * Сборка метаданных генератора из выгрузки `dsbuilder components fetch` и web-маппингов.
 *
 * Генератор ждёт прежнюю модель `Meta` (связи через идентификаторы, web-маппинг в `sources.api`),
 * а данные лежат в трёх источниках: значения — в native-конфигах `components/`, имена
 * web-параметров — в аннотациях токенов установленного пакета компонентов (собираются на каждый
 * запуск), имена, описания, шаблоны и compose-связи — во временном `.sdds/web/web-adapter.json` из базы.
 * Идентификаторы строятся из имён: генератору они нужны только для связей внутри одного компонента.
 */

interface NativeValue {
    type: string;
    value?: unknown;
    default?: unknown;
    adjustment?: unknown;
    states?: Array<{ state: string[]; value: unknown }>;
}

interface NativeBinding {
    name: string;
    type: 'enum' | 'boolean';
    values?: Array<string | boolean>;
    defaultValue?: string | boolean;
}

interface NativeConfig {
    props?: Record<string, NativeValue>;
    bindings?: NativeBinding[];
    variations?: Array<{
        id: string;
        binding: Array<{ name: string; value: string | boolean }>;
        props: Record<string, NativeValue>;
    }>;
}

interface PackageMeta {
    components: Array<{ componentName: string; styleName: string; config: string }>;
}

/** Шаблоны одной конфигурации: свойство -> web-параметр -> шаблон. */
type StyleTemplates = Record<string, Record<string, string>>;

/** Запись `web-adapter.json`: компонент по имени в написании `meta.json`, пустые поля опущены. */
interface WebAdapterComponent {
    componentName: string;
    name: string;
    description?: string;
    compose?: string[];
    styles?: Record<string, { templates: StyleTemplates }>;
}

export interface ApiMetaComponent {
    componentName: string;
    params: Array<{ paramName: string; type: string; id: string; part?: string; state?: string }>;
}

export interface ComponentSourcePaths {
    /** Каталог выгрузки: `meta.json` и конфиги. */
    componentsDirectory: string;
    /** Каталог web-данных: `web-adapter.json` из `components fetch` для React. */
    webDirectory: string;
    /** Маппинги Style API установленного пакета компонентов, собранные `buildApiMeta`. */
    apiMeta: ApiMetaComponent[];
}

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T;

/**
 * Имя из `meta.json` в имя компонента кода: `icon-tab-item` → `IconTabItem`. Запасной путь для
 * компонента без записи в `web-adapter.json`; обычно имя берётся оттуда, из базы.
 */
const toComponentName = (kebab: string) =>
    kebab
        .split(/[.-]/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('');

/**
 * Типографика хранится ссылкой на токен экрана, а генератор подставляет экран сам; legacy-выгрузка
 * срезала префикс так же.
 */
const stripScreen = (value: string) => value.replace(/^screen-\w+\./, '');

/** Значение в форме генератора: строкой, как его отдавала legacy-выгрузка. */
const toValue = (value: unknown, type: string): string | undefined => {
    if (value === undefined || value === null) {
        return undefined;
    }
    const text = String(value);
    return type === 'typography' ? stripScreen(text) : text;
};

/** Цвет и градиент лежат в `default`, остальные типы — в `value`. */
const toPropConfig = (id: string, native: NativeValue): PropConfig => {
    const prop: PropConfig = {
        id,
        value: toValue(native.default ?? native.value, native.type),
        states: (native.states ?? []).map(({ state, value }) => ({
            state: state as never,
            value: toValue(value, native.type),
        })),
    };
    if (native.adjustment !== undefined && native.adjustment !== null) {
        prop.adjustment = String(native.adjustment);
    }
    return prop;
};

/**
 * Тип свойства для выбора класса значения в генераторе.
 *
 * Берётся из выгрузки, а не из аннотации токена: аннотация описывает CSS-значение целиком
 * (`itemPadding` — `value`, потому что это `0 8px`), а выгрузка — то, что лежит в модели
 * (`dimension`, раскладываемый шаблоном `0 $1`). Градиент — заливка слота `color`.
 */
const toPropType = (type: string): PropType => (type === 'gradient' ? 'color' : type) as PropType;

const styleId = (variation: string, style: string | boolean) => `${variation}:${String(style)}`;

/** Конфигурация одного appearance в модели генератора. */
const toConfig = (styleName: string, native: NativeConfig): Config => {
    const bindings = native.bindings ?? [];
    const entries = native.variations ?? [];
    const single = entries.filter((entry) => entry.binding.length === 1);

    const variations = bindings.map((binding) => {
        const own = single.filter((entry) => entry.binding[0].name === binding.name);
        // У булевой вариации значения не перечислены, а запись без свойств native-формат не хранит.
        // Стиль `true` у флага есть всегда, как в legacy-модели: генератор пишет его и пустым.
        const values =
            binding.values ??
            [...new Set([true, ...own.map((entry) => entry.binding[0].value)].map(String))].map((value) =>
                value === 'true' ? true : value,
            );
        const styles: StyleConfig[] = values.map((value) => {
            const entry = own.find((item) => String(item.binding[0].value) === String(value));
            return {
                name: String(value),
                id: styleId(binding.name, value),
                intersections: null,
                props: Object.entries(entry?.props ?? {}).map(([name, prop]) => toPropConfig(name, prop)),
            };
        });
        return { id: binding.name, styles };
    });

    const combinations = entries
        .filter((entry) => entry.binding.length > 1)
        .map((entry) => ({
            styleIDs: entry.binding.map(({ name, value }) => styleId(name, value)).sort(),
            props: Object.entries(entry.props).map(([name, prop]) => toPropConfig(name, prop)),
        }));

    return {
        name: styleName,
        id: styleName,
        config: {
            defaultVariations: bindings
                .filter((binding) => binding.defaultValue !== undefined)
                .map((binding) => ({ variationID: binding.name, styleID: styleId(binding.name, binding.defaultValue!) })),
            invariantProps: Object.entries(native.props ?? {}).map(([name, prop]) => toPropConfig(name, prop)),
            variations,
            ...(combinations.length > 0 ? { combinations } : {}),
        },
    };
};

/** Все значения конфигурации: инварианты, вариации и сочетания. */
const valuesOf = (native: NativeConfig): Array<[string, NativeValue]> => [
    ...Object.entries(native.props ?? {}),
    ...(native.variations ?? []).flatMap((entry) => Object.entries(entry.props)),
];

/**
 * API компонента: свойства со значениями и их web-параметры.
 *
 * Web-параметры берутся из аннотаций токенов: параметры с `state` генератор выводит сам
 * суффиксом от базового имени, поэтому в маппинг идут только базовые и части типографики.
 * Свойство без единого web-параметра в API не попадает — генератор пропустил бы его так же.
 */
const toApi = (
    natives: Array<{ styleName: string; native: NativeConfig }>,
    apiMeta: ApiMetaComponent | undefined,
    templates: Map<string, StyleTemplates>,
): ComponentAPI[] => {
    const typeByProperty = new Map<string, string>();
    for (const { native } of natives) {
        for (const [name, value] of valuesOf(native)) {
            if (!typeByProperty.has(name)) typeByProperty.set(name, value.type);
        }
    }
    // Шаблон параметра в выгрузке принадлежит конфигурации, а API в модели генератора один на
    // компонент; внутри компонента шаблоны appearance совпадают, поэтому берётся первый.
    const templateOf = (property: string, param: string) => {
        for (const { styleName } of natives) {
            const template = templates.get(styleName)?.[property]?.[param];
            if (template) return template;
        }
        return null;
    };

    return [...typeByProperty]
        .map(([name, type]): ComponentAPI | null => {
            const web = (apiMeta?.params ?? [])
                .filter((param) => param.id === name && !param.state)
                .map((param) => ({ name: param.paramName, adjustment: templateOf(name, param.paramName) }));
            if (web.length === 0) {
                return null;
            }
            return {
                id: name,
                name,
                type: toPropType(type),
                variations: null,
                platformMappings: { xml: null, compose: null, ios: null, web },
            };
        })
        .filter((item): item is ComponentAPI => item !== null);
};

/**
 * Читает выгрузку и web-маппинги и возвращает метаданные генератора в порядке `meta.json`.
 *
 * Компонент без маппингов в пакете компонентов не отклоняется: он попадает в пакет без API,
 * и генератор пишет для него обёртку над базовым конфигом ядра.
 */
export async function readComponentsMeta({
    componentsDirectory,
    webDirectory,
    apiMeta,
}: ComponentSourcePaths): Promise<Meta[]> {
    const packageMeta = await readJson<PackageMeta>(join(componentsDirectory, 'meta.json'));
    const adapter = new Map(
        (await readJson<WebAdapterComponent[]>(join(webDirectory, 'web-adapter.json'))).map((entry) => [
            entry.componentName,
            entry,
        ]),
    );

    const apiMetaByName = new Map(apiMeta.map((component) => [component.componentName, component]));
    const nameOf = (kebab: string) => adapter.get(kebab)?.name ?? toComponentName(kebab);

    const order: string[] = [];
    const configsByComponent = new Map<string, Array<{ styleName: string; native: NativeConfig }>>();
    for (const entry of packageMeta.components) {
        if (!configsByComponent.has(entry.componentName)) {
            order.push(entry.componentName);
            configsByComponent.set(entry.componentName, []);
        }
        configsByComponent.get(entry.componentName)!.push({
            styleName: entry.styleName,
            native: await readJson<NativeConfig>(join(componentsDirectory, entry.config)),
        });
    }

    return order.map((kebab) => {
        const name = nameOf(kebab);
        const entry = adapter.get(kebab);
        const natives = configsByComponent.get(kebab)!;
        const templates = new Map(Object.entries(entry?.styles ?? {}).map(([style, { templates }]) => [style, templates]));
        const bindingNames = [...new Set(natives.flatMap(({ native }) => (native.bindings ?? []).map((item) => item.name)))];

        return {
            name,
            description: entry?.description ?? '',
            deps: (entry?.compose ?? []).map((child, index) => ({
                childId: child,
                childName: nameOf(child),
                type: 'compose' as const,
                order: index,
            })),
            sources: {
                api: toApi(natives, apiMetaByName.get(name), templates),
                variations: bindingNames.map((variation) => ({ id: variation, name: variation })),
                configs: natives.map(({ styleName, native }) => toConfig(styleName, native)),
            },
        };
    });
}
