import * as plasmaCore from '@salutejs/plasma-new-hope/styled-components';
import { segmentTokens, stepsTokens, tabsTokens, typographyTokens } from '@salutejs/plasma-new-hope/styled-components';

/**
 * Перенос `js/apps/client/src/controllers/componentPreview/coreTokens.ts`: `getCSSVariableName`/`toCSSVariables`,
 * таблицы исключений ядра и `getCoreConfig`. Логика должна совпадать с клиентской, пока React-превью клиента
 * остаётся запасным.
 */

/**
 * Объект токенов ядра по компоненту, если он называется не `<component>Tokens`.
 * Зеркало манифестов генератора (`cli/src/generator/templates/<X>/component.json`, поле `coreTokensExport`).
 */
export const coreTokensByComponent: Record<string, Record<string, string>> = {
    Tabs: tabsTokens,
    TabItem: tabsTokens,
    IconTabItem: tabsTokens,
    Steps: stepsTokens,
    StepItem: stepsTokens,
    SegmentGroup: segmentTokens,
    SegmentItem: segmentTokens,
    Body: typographyTokens,
    Dspl: typographyTokens,
    Heading: typographyTokens,
    Text: typographyTokens,
};

/**
 * Конфиг ядра по компоненту, если он называется не `<component>Config`.
 * Зеркало поля `coreConfigExport` в манифестах генератора.
 */
export const coreConfigNameByComponent: Record<string, string> = {
    Skeleton: 'lineSkeletonConfig',
};

const lowerFirstLetter = (value: string) => `${value.charAt(0).toLowerCase()}${value.slice(1)}`;

const coreExports = plasmaCore as Record<string, unknown>;

/** Объект токенов ядра компонента: исключение из таблицы или экспорт `<component>Tokens`. */
export const getCoreTokens = (componentName: string): Record<string, string> | undefined =>
    coreTokensByComponent[componentName] ??
    (coreExports[`${lowerFirstLetter(componentName)}Tokens`] as Record<string, string> | undefined);

/** Базовый конфиг компонента в ядре: исключение из таблицы (`Skeleton` → `lineSkeletonConfig`) или `<component>Config`. */
export const getCoreConfig = (componentName: string): unknown =>
    coreExports[coreConfigNameByComponent[componentName] ?? `${lowerFirstLetter(componentName)}Config`];

const upperFirstLetter = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

/** Копия `camelToKebab` из `js/apps/client/src/utils/text.ts`. */
export const camelToKebab = (str?: string) => {
    if (!str) {
        return '';
    }

    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
};

/**
 * Имя CSS-переменной для ключа web-параметра. Сначала ищем её в объекте токенов ядра компонента: у части компонентов
 * имена переменных не выводятся из ключа. Если объекта нет или ключа в нём нет — строим имя по схеме
 * `--plasma-<component>-<key>` (`backgroundColorHover` → `--plasma-button-background-color-hover`).
 */
export const getCSSVariableName = (componentName: string, tokenKey: string, coreTokens?: Record<string, string>) => {
    const cssVariable = coreTokens?.[tokenKey];

    if (typeof cssVariable === 'string' && cssVariable.trim().startsWith('--')) {
        return cssVariable.trim();
    }

    const formatted = upperFirstLetter(tokenKey).startsWith(componentName)
        ? upperFirstLetter(tokenKey)
        : `${componentName}${upperFirstLetter(tokenKey)}`;

    return camelToKebab(`--plasma${formatted}`);
};

/** Значения по ключам web-параметров → значения по именам CSS-переменных ядра. */
export const toCSSVariables = (
    componentName: string,
    values: Record<string, string> | null | undefined,
    coreTokens?: Record<string, string>,
) =>
    Object.entries(values ?? {}).reduce<Record<string, string>>(
        (acc, [key, value]) => ({ ...acc, [getCSSVariableName(componentName, key, coreTokens)]: value }),
        {},
    );

/** Web-параметры компонента (`component.properties`, связанные компоненты) → CSS-переменные ядра по его объекту токенов. */
export const toCoreCssVariables = (componentName: string, properties: Record<string, string> | null | undefined) =>
    toCSSVariables(componentName, properties, getCoreTokens(componentName));
