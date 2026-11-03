import type { Config } from '../../controllers';
import type { ComponentGroup } from '../../utils';

export type ComponentPlatformFilter = 'all' | 'web' | 'compose' | 'xml' | 'ios';
export type EditablePlatform = 'web' | 'compose';

export const PLATFORM_FILTERS: { id: ComponentPlatformFilter; label: string }[] = [
    { id: 'all', label: 'Все платформы' },
    { id: 'web', label: 'Web' },
    { id: 'compose', label: 'Compose' },
    { id: 'xml', label: 'Android XML' },
    { id: 'ios', label: 'iOS' },
];

export interface ComponentTreeEntry {
    name: string;
    /** Записи компонента на платформах, которые входят в выбранный фильтр: сначала Web. */
    configs: Config[];
}

export interface ComponentTreeGroup {
    name: string;
    items: ComponentTreeEntry[];
}

const GROUP_LABELS: Record<string, string> = {
    'Data Display': 'Отображение данных',
    'Data Entry': 'Ввод данных',
    Navigation: 'Навигация',
    Overlay: 'Оверлеи',
    Layout: 'Компоновка',
    Other: 'Другое',
};

export const componentGroupLabel = (group: string) => GROUP_LABELS[group] ?? group;

/** Записи платформ объединяются по имени: группу задаёт первая платформа, в которой компонент найден. */
export const buildComponentTree = (
    groups: Record<EditablePlatform, ComponentGroup[]>,
    filter: ComponentPlatformFilter,
    query: string,
): ComponentTreeGroup[] => {
    const platforms: EditablePlatform[] =
        filter === 'all' ? ['web', 'compose'] : filter === 'web' || filter === 'compose' ? [filter] : [];
    const normalizedQuery = query.trim().toLowerCase();
    const entries = new Map<string, { group: string; entry: ComponentTreeEntry }>();

    platforms.forEach((platform) =>
        groups[platform].forEach(({ name: group, items }) =>
            items.forEach((config) => {
                const name = config.getName();
                if (!name.toLowerCase().includes(normalizedQuery)) return;
                const existing = entries.get(name);
                if (existing) existing.entry.configs.push(config);
                else entries.set(name, { group, entry: { name, configs: [config] } });
            }),
        ),
    );

    const order = [...new Set(platforms.flatMap((platform) => groups[platform].map(({ name }) => name)))].sort(
        (a, b) => Number(a === 'Other') - Number(b === 'Other') || a.localeCompare(b),
    );

    return order
        .map((name) => ({
            name,
            items: [...entries.values()]
                .filter(({ group }) => group === name)
                .map(({ entry }) => entry)
                .sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .filter(({ items }) => items.length > 0);
};

/** Платформа, которую откроет строка: на вкладке — она сама, на «Все» — первая доступная (Web, затем Compose). */
export const entryPlatform = (entry: ComponentTreeEntry, filter: ComponentPlatformFilter): EditablePlatform =>
    filter === 'web' || filter === 'compose' ? filter : (entry.configs[0].getPlatform() as EditablePlatform);

export const emptyTreeMessage = (total: number, onPlatform: number, filter: ComponentPlatformFilter, query: string) => {
    if (!total) return 'Все компоненты скрыты. Верните нужный компонент в дизайн-систему.';
    if (!onPlatform) return 'Для выбранной платформы компонентов нет. Выберите другую платформу.';
    return query.trim() ? `По запросу «${query.trim()}» компонентов не найдено.` : 'Компонентов нет.';
};
