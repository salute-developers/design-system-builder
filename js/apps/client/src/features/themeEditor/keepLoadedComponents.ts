import type { Config } from '../../controllers/componentBuilder/config';

const sameComponent = (a: Config, b: Config) => a.getName() === b.getName() && a.getPlatform() === b.getPlatform();

/**
 * Список компонентов после чтения индекса: индекс несёт только состав, а данные компонентов в его снимке — кеш
 * прошлого чтения раздела без подтверждённых правок. Загруженные экземпляры остаются, новые добавляются, пропавшие
 * из индекса уходят.
 */
export function keepLoadedComponents(current: Config[] | null, next: Config[]): Config[] {
    return next.map((item) => current?.find((loaded) => sameComponent(loaded, item)) ?? item);
}

/**
 * Список компонентов после чтения компонента: экземпляр с прежним содержимым остаётся тем же объектом. Снимок
 * пересоздаёт экземпляры всех компонентов, и открытый редактор получал новый объект, пока правка, сделанная секундой
 * раньше, ещё лежала на прежнем: она пропадала с экрана до следующего чтения. Экземпляр с изменившимся содержимым,
 * в том числе с локальной правкой, заменяется как раньше; несохранённые правки сберегает `preservePendingComponents`.
 */
export function keepUnchangedComponents(current: Config[] | null, next: Config[]): Config[] {
    return next.map((item) => {
        const existing = current?.find((loaded) => sameComponent(loaded, item));
        if (!existing || existing.getConfigurations().length === 0) return item;
        if (existing.getConfigurationId() !== item.getConfigurationId()) return item;

        return contentKey(existing) === contentKey(item) ? existing : item;
    });
}

/**
 * Содержимое компонента для сравнения: значения открытой конфигурации (`getMeta`), а также то, что меняют структурные
 * операции и чего нет в `getMeta`: список конфигураций (дублирование, удаление, переименование), имена вариаций и
 * пересечения. Без них экземпляр после структурной операции оставался прежним и показывал старый состав.
 */
const contentKey = (config: Config) =>
    JSON.stringify({
        meta: config.getMeta(),
        configurations: config.getConfigurations(),
        variations: config.getVariations().map((variation) => [variation.getID(), variation.getName()]),
        catalog: [...config.getCatalogVariationNames()],
        combinations: config.getCombinations(),
    });
