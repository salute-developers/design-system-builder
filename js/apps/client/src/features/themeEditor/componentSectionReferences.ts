import type { Meta } from '../../controllers/componentBuilder/type';

/** Только ссылки component_style выбранного компонента, не произвольные строки конфигурации. */
export function componentSectionReferences(component: Meta): Set<string> {
    const propertyIds = new Set(
        component.sources.api.filter((property) => property.type === 'component_style').map((property) => property.id),
    );
    const references = new Set<string>();
    const collectValues = (value: unknown) => {
        if (typeof value === 'string') references.add(value.split('.')[0]);
        else if (Array.isArray(value)) value.forEach(collectValues);
        else if (value && typeof value === 'object') Object.values(value).forEach(collectValues);
    };
    const visit = (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        const object = value as Record<string, unknown>;
        if (typeof object.id === 'string' && propertyIds.has(object.id)) {
            collectValues(object.value);
            if (Array.isArray(object.states))
                object.states.forEach((state) => {
                    if (state && typeof state === 'object') collectValues((state as Record<string, unknown>).value);
                });
        } else Object.values(object).forEach(visit);
    };
    visit(component.sources.configs);
    return references;
}
