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
