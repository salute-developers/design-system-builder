import { Config, type DesignSystem } from '../controllers';

/**
 * Компоненты, стили которых web-плагину нужны целиком: сам компонент, его зависимости любого типа (`reuse` —
 * полный конфиг вложенного компонента для story, `compose` — элемент внутри родителя) и родители, у которых он
 * дочерний по `compose` (общие значения одноимённых вариаций). Компоненты без данных в дизайн-системе пропускаются.
 *
 * `cache` хранит экземпляры `Config` связанных компонентов между пересборками payload.
 */
export const collectRelatedConfigs = (
    designSystem: DesignSystem,
    config: Config,
    cache: Map<string, Config> = new Map(),
): Config[] => {
    const currentName = config.getName();
    const all = designSystem.getComponentsData();
    const current = all.find((item) => item.name === currentName);
    const children = (current?.deps ?? []).map((dep) => dep.childName);
    const parents = [
        ...(current?.composeParents ?? []),
        ...all
            .filter((item) => (item.deps ?? []).some((dep) => dep.type === 'compose' && dep.childName === currentName))
            .map((item) => item.name),
    ];
    const names = [...new Set([...children, ...parents])].filter(
        (name): name is string => Boolean(name) && name !== currentName,
    );

    return [
        config,
        ...names.flatMap((name) => {
            if (!cache.has(name)) {
                const meta = all.find((item) => item.name === name);
                if (!meta) return [];
                cache.set(name, new Config(meta));
            }
            return [cache.get(name)!];
        }),
    ];
};
