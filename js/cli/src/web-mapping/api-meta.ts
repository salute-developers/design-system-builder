/**
 * Web API-мета ядра: по компоненту параметры токенов ядра с аннотациями Style API (`@styleType`, `@styleProp`, …).
 * `id` — каноническое имя свойства конфигурации, `paramName` — ключ токена ядра, `state` — состояние,
 * `part` — поле составного значения (типографики).
 */
export interface ApiMetaParam {
    paramName: string;
    type: string;
    id: string;
    part?: string;
    state?: string;
    deprecated?: { message?: string };
}

export interface ApiMetaComponent {
    componentName: string;
    params: ApiMetaParam[];
}

export type ApiMeta = ApiMetaComponent[];

/** Параметры ядра свойства без состояния: параметры состояний выводятся из них суффиксом `STATE_PARAM_SUFFIX`. */
export const basePropertyParams = (component: ApiMetaComponent | undefined, property: string): ApiMetaParam[] =>
    (component?.params ?? []).filter((param) => param.id === property && !param.state);

/** Суффикс ключа ядра для состояния: `<ключ>Hover` при наведении, `<ключ>Active` при нажатии. */
export const STATE_PARAM_SUFFIX: Readonly<Record<string, string>> = { hovered: 'Hover', pressed: 'Active' };
