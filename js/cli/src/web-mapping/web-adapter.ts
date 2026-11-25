import bundledAdapter from '../data/web-adapter.json' with { type: 'json' };

/** Шаблоны одной конфигурации: свойство → ключ ядра → шаблон (`0 $1`). */
export type StyleTemplates = Record<string, Record<string, string>>;

/** Запись `web-adapter.json`: компонент по имени в написании `meta.json`, пустые поля опущены. */
export interface WebAdapterEntry {
    componentName: string;
    name: string;
    description?: string;
    compose?: string[];
    styles?: Record<string, { templates?: StyleTemplates }>;
}

export type WebAdapter = WebAdapterEntry[];

/** Встроенный `src/data/web-adapter.json`: имена, описания, шаблоны web-параметров и compose-связи компонентов. */
export const webAdapter: WebAdapter = bundledAdapter as WebAdapter;

/** Подстановка `$1…$n`; номер без значения остаётся как есть (`$2` при одном значении). */
export const applyTemplate = (template: string, values: readonly string[]): string =>
    template.replace(/\$(\d+)/g, (placeholder, index: string) => values[Number(index) - 1] ?? placeholder);

/** Имя из `meta.json` в имя компонента кода: `icon-tab-item` → `IconTabItem`. */
export const toComponentName = (kebab: string): string =>
    kebab
        .split(/[.-]/)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('');

/**
 * Дочерние компоненты `compose` записи в порядке файла: `id` — имя в написании `meta.json`, `name` — имя кода
 * из записи адаптера, а без неё — `toComponentName`.
 */
export const composeOf = (entry: WebAdapterEntry | undefined, adapter: WebAdapter): Array<{ id: string; name: string }> =>
    (entry?.compose ?? []).map((id) => ({
        id,
        name: adapter.find((item) => item.componentName === id)?.name ?? toComponentName(id),
    }));
