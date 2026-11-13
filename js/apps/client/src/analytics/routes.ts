import { matchPath } from 'react-router-dom';

export type AnalyticsView = Readonly<{ path: string; title: string }>;

const project = '/projects/:projectId';
const system = `${project}/design-systems/:designSystemId`;
const theme = `${system}/themes/:tenantId`;
const routes: ReadonlyArray<readonly [string, string]> = [
    ['/login', 'Вход'],
    ['/projects', 'Проекты'],
    ['/projects/new', 'Создание проекта'],
    [`${project}/design-systems/new`, 'Создание дизайн-системы'],
    [`${project}/settings`, 'Настройки проекта'],
    [project, 'Проект'],
    [`${system}/settings`, 'Настройки дизайн-системы'],
    [`${system}/themes/new`, 'Создание темы'],
    [system, 'Дизайн-система'],
    ...Object.entries({
        palette: 'Палитра',
        colors: 'Цвета',
        shapes: 'Формы',
        typography: 'Типографика',
        'components/:componentName?': 'Компоненты',
        changes: 'Изменения',
        versions: 'Версии',
        settings: 'Настройки темы',
    }).map(([section, title]) => [`${theme}/${section}`, title] as const),
];

/** Только устойчивые экраны: индексы, legacy URL и промежуточные редиректы отсутствуют. */
export const normalizeAnalyticsView = (pathname: string): AnalyticsView | undefined => {
    const route = routes.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
    return route ? { path: route[0].replace(/\?$/, ''), title: route[1] } : undefined;
};
