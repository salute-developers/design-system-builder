import type { Meta } from '../controllers';

/** Префикс сегмента URL: Compose-компонент не должен совпасть по имени с web-компонентом. */
const COMPOSE_ROUTE_PREFIX = 'compose-';

export interface ComponentRoute {
    platform: 'web' | 'compose';
    name: string;
}

export const toComponentRoute = (platform: ComponentRoute['platform'], name: string) =>
    platform === 'compose' ? `${COMPOSE_ROUTE_PREFIX}${name}` : name;

export const parseComponentRoute = (segment: string): ComponentRoute =>
    segment.startsWith(COMPOSE_ROUTE_PREFIX)
        ? { platform: 'compose', name: segment.slice(COMPOSE_ROUTE_PREFIX.length) }
        : { platform: 'web', name: segment };

/**
 * Есть ли у компонента хотя бы одна конфигурация оформления. Компонент без неё есть в api-мете и привязан к
 * дизайн-системе, но стилей для него в дизайн-системе нет: превью рисует его стилем по умолчанию и выглядит сломанным.
 */
export const hasConfiguration = (component: Meta): boolean => (component.sources?.configs?.length ?? 0) > 0;

/**
 * Помечает компоненты платформой Compose и выводит привязку к плагину из имени: имя в API-мете
 * платформы совпадает с `componentName`, под которым компонент зарегистрирован в плагине.
 */
export const markComposeComponents = (components: Meta[]): Meta[] =>
    components.map((component) => ({
        ...component,
        platform: 'compose',
        preview: {
            ...component.preview,
            compose: component.preview?.compose ?? { componentId: component.name, storyId: component.name },
        },
    }));
