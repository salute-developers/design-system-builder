import type { ComponentAPI, ComponentDep, WebToken } from '../controllers/componentBuilder/type';

/**
 * Дополнение модели компонентов редактора тем данными, которых нет в ответах `componentRepository`.
 *
 * Превью берёт имена CSS-переменных из web-параметров свойства (`platformMappings.web`), панель свойств
 * фильтрует их по объявленным вариациям (`variations`). Многозначное CSS-значение раскладывается шаблоном
 * из `web-adapter` (`0 $1`). Связанные компоненты превью собирает по `deps`. Функции чистые: запросы
 * делает загрузчик, здесь только сборка по ответам ds-service.
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

/** Шаблоны одной конфигурации: свойство -> web-параметр -> шаблон. */
type StyleTemplates = Record<string, Record<string, string>>;

/** Запись `POST /component-config/web-adapter`: компонент по имени, шаблоны web-параметров по стилям. */
export interface WebAdapterComponentDto {
    componentName: string;
    name: string;
    styles?: Record<string, { templates: StyleTemplates }> | null;
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

/**
 * Шаблон web-параметра компонента. Шаблон принадлежит конфигурации, а API в модели один на компонент;
 * внутри компонента шаблоны appearance совпадают, поэтому берётся первый найденный по стилям.
 */
export const templateLookup = (entry: WebAdapterComponentDto | undefined, styleNames: string[]) => {
    const styles = entry?.styles ?? {};
    return (property: string, param: string): string | null => {
        for (const style of styleNames) {
            const template = styles[style]?.templates?.[property]?.[param];
            if (template) return template;
        }
        return null;
    };
};

/** Заполняет web-параметры и объявленные вариации свойств API компонента. */
export const enrichApi = (
    api: ComponentAPI[],
    webParams: ReadonlyMap<string, string[]>,
    variationNames: ReadonlyMap<string, string[]>,
    templateOf: (property: string, param: string) => string | null,
): ComponentAPI[] =>
    api.map((item) => {
        const params = webParams.get(item.id) ?? [];
        const web: WebToken[] | null = params.length
            ? params.map((name) => ({ name, adjustment: templateOf(item.name, name) }))
            : null;
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
