/** Имена экспортов ядра из манифеста генератора `templates/<X>/component.json`, если они не `<x>Tokens`/`<x>Config`. */
export interface CoreExportNames {
    coreTokensExport?: string | null;
    coreConfigExport?: string | null;
}

const lowerFirstLetter = (value: string) => value.charAt(0).toLocaleLowerCase() + value.slice(1);

/** Объект токенов ядра компонента: из манифеста (`TabItem` → `tabsTokens`) или `<x>Tokens`. */
export const coreTokensExportName = (componentName: string, manifest?: CoreExportNames): string =>
    manifest?.coreTokensExport || `${lowerFirstLetter(componentName)}Tokens`;

/** Базовый конфиг ядра компонента: из манифеста (`Skeleton` → `lineSkeletonConfig`) или `<x>Config`. */
export const coreConfigExportName = (componentName: string, manifest?: CoreExportNames): string =>
    manifest?.coreConfigExport || `${lowerFirstLetter(componentName)}Config`;
