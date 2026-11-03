import bundledAdapter from '../data/web-adapter.json';

/**
 * Шаблоны многозначных свойств `web-adapter.json` (перенесён из `js/cli/.sdds/web`): по компоненту и конфигурации
 * `свойство → {ключ ядра: шаблон}`, например `Button.iconMargin → buttonLeftContentMargin: "0 $1 -0.125rem"`.
 */
export interface WebAdapterEntry {
    componentName: string;
    name: string;
    styles?: Record<string, { templates?: Record<string, Record<string, string>> }> | null;
}

export type WebAdapter = WebAdapterEntry[];

export const webAdapter = bundledAdapter as WebAdapter;

/** Компонент → `свойство\0ключ ядра` → шаблон. */
export type TemplateIndex = Map<string, Map<string, string>>;

const templateKey = (property: string, param: string) => `${property}\u0000${param}`;

const indexCache = new WeakMap<WebAdapter, TemplateIndex>();

/**
 * Индекс шаблонов. Шаблон принадлежит конфигурации компонента, а плагин её не знает, поэтому берётся первый
 * найденный по конфигурациям в порядке файла — как `templateLookup` клиента, который шёл по конфигурациям компонента.
 */
export const indexTemplates = (adapter: WebAdapter): TemplateIndex => {
    const cached = indexCache.get(adapter);
    if (cached) return cached;

    const index: TemplateIndex = new Map();
    for (const entry of adapter) {
        const templates = index.get(entry.name) ?? new Map<string, string>();
        for (const style of Object.values(entry.styles ?? {})) {
            for (const [property, params] of Object.entries(style?.templates ?? {})) {
                for (const [param, template] of Object.entries(params)) {
                    const key = templateKey(property, param);
                    if (template && !templates.has(key)) templates.set(key, template);
                }
            }
        }
        if (templates.size) index.set(entry.name, templates);
    }
    indexCache.set(adapter, index);
    return index;
};

export const templateFor = (index: TemplateIndex, component: string, property: string, param: string) =>
    index.get(component)?.get(templateKey(property, param));

/** Подстановка `$1…$n`; номер без значения остаётся как есть, как `replaceAdjustmentPlaceholders` прежнего клиента. */
export const applyTemplate = (template: string, values: string[]) =>
    template.replace(/\$(\d+)/g, (placeholder, index: string) => values[Number(index) - 1] ?? placeholder);
