import type { ComponentAPI, ComponentDep, WebToken } from '../controllers/componentBuilder/type';

/**
 * Дополнение модели компонентов редактора тем данными, которых нет в ответах `componentRepository`.
 *
 * Сборка payload отбирает свойства по web-параметрам (`platformMappings.web`), панель свойств фильтрует их
 * по объявленным вариациям (`variations`). Связанные компоненты превью собираются по `deps`. Функции чистые:
 * запросы делает загрузчик, здесь только сборка по ответам ds-service.
 */

/** Платформенное имя свойства из `GET /property-platform-params`. */
export interface PropertyPlatformParamDto {
    id: string;
    propertyId: string;
    platform: string;
    name: string;
}

/** Связь свойства с панелью вариации из `GET /property-variations`. */
export interface PropertyVariationDto {
    propertyId: string;
    variationId: string;
}

/** Web-параметры свойства в порядке базы: так их заводил импорт API-меты. */
export const webParamsByProperty = (params: PropertyPlatformParamDto[]) => {
    const byProperty = new Map<string, string[]>();
    for (const param of params) {
        if (param.platform !== 'web') continue;
        byProperty.set(param.propertyId, [...(byProperty.get(param.propertyId) ?? []), param.name]);
    }
    return byProperty;
};

/** Compose-параметры свойства: их имена в `composeParameters` нужны сборке payload Compose-превью. */
export const composeParamsByProperty = (params: PropertyPlatformParamDto[]) => {
    const byProperty = new Map<string, string[]>();
    for (const param of params) {
        if (param.platform !== 'compose') continue;
        byProperty.set(param.propertyId, [...(byProperty.get(param.propertyId) ?? []), param.name]);
    }
    return byProperty;
};

/** Имена вариаций, в панелях которых показывается свойство. */
export const variationNamesByProperty = (
    links: PropertyVariationDto[],
    variationNameById: ReadonlyMap<string, string>,
) => {
    const byProperty = new Map<string, string[]>();
    for (const link of links) {
        const name = variationNameById.get(link.variationId);
        if (name) byProperty.set(link.propertyId, [...(byProperty.get(link.propertyId) ?? []), name]);
    }
    return byProperty;
};

/** Заполняет web-параметры и объявленные вариации свойств API компонента. */
export const enrichApi = (
    api: ComponentAPI[],
    webParams: ReadonlyMap<string, string[]>,
    variationNames: ReadonlyMap<string, string[]>,
): ComponentAPI[] =>
    api.map((item) => {
        const params = webParams.get(item.id) ?? [];
        const web: WebToken[] | null = params.length ? params.map((name) => ({ name })) : null;
        return {
            ...item,
            variations: variationNames.get(item.id) ?? item.variations,
            platformMappings: { ...item.platformMappings, web },
        };
    });

/** Связь компонентов из `GET /component-deps`: слой общий для всех дизайн-систем, ссылки по id. */
export interface ComponentDependencyDto {
    parentId: string;
    childId: string;
    type: 'compose' | 'reuse';
    order: number | null;
}

/**
 * Зависимости по имени родителя: связи обоих типов (`compose` раскладывает элемент в папку родителя,
 * `reuse` отдаёт ребёнку полный конфиг темы в превью). Связь с компонентом вне дизайн-системы
 * пропускается; порядок — по `order` (отсутствующий считается 0, как в web-адаптере), при равенстве по имени ребёнка.
 */
export const collectDependencies = (
    dependencies: ComponentDependencyDto[],
    componentNameById: ReadonlyMap<string, string>,
) => {
    const byParent = new Map<string, ComponentDep[]>();
    const sorted = [...dependencies].sort(
        (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) ||
            (componentNameById.get(a.childId) ?? '').localeCompare(componentNameById.get(b.childId) ?? ''),
    );
    for (const dependency of sorted) {
        const parent = componentNameById.get(dependency.parentId);
        const child = componentNameById.get(dependency.childId);
        if (!parent || !child) continue;
        const deps = byParent.get(parent) ?? [];
        deps.push({ childId: dependency.childId, childName: child, type: dependency.type, order: deps.length });
        byParent.set(parent, deps);
    }
    return byParent;
};
