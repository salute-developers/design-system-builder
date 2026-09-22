import * as plasmaCore from '@salutejs/plasma-new-hope/styled-components';
import {
    segmentTokens,
    stepsTokens,
    tabsTokens,
    typographyTokens,
} from '@salutejs/plasma-new-hope/styled-components';

import { camelToKebab } from '../../utils';
import type { WebTokenValues } from '../componentBuilder';

/**
 * Объект токенов ядра по компоненту, если он называется не `<component>Tokens`.
 * Зеркало манифестов генератора (`app/templates/<X>/component.json`, поле `coreTokensExport`):
 * превью сопоставляет свойство компонента CSS-переменной ядра по этому объекту.
 * База об этом не знает: имя экспорта ядра — нюанс пакета, а не данных ДС.
 */
const coreTokensByComponent: Record<string, Record<string, string>> = {
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

const lowerFirstLetter = (value: string) => `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
const upperFirstLetter = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

/**
 * Имя CSS-переменной для ключа токена ядра. Сначала ищем её в объекте токенов ядра
 * (`textFieldTokens.backgroundColor` → `--plasma-textfield-bg-color`): у части компонентов
 * имена переменных не выводятся из ключа. Если ядро объекта не экспортирует или ключа в нём
 * нет — строим имя по схеме `--plasma-<component>-<key>`.
 */
export const getCSSVariableName = (componentName: string, tokenKey: string) => {
    const coreTokens =
        coreTokensByComponent[componentName] ??
        ((plasmaCore as Record<string, unknown>)[`${lowerFirstLetter(componentName)}Tokens`] as
            | Record<string, string>
            | undefined);
    const cssVariable = coreTokens?.[tokenKey];

    if (typeof cssVariable === 'string' && cssVariable.trim().startsWith('--')) {
        return cssVariable.trim();
    }

    const formatted = upperFirstLetter(tokenKey).startsWith(componentName)
        ? upperFirstLetter(tokenKey)
        : `${componentName}${upperFirstLetter(tokenKey)}`;

    return camelToKebab(`--plasma${formatted}`);
};

/** Значения по ключам токенов ядра → значения по именам CSS-переменных, как их ждёт компонент в превью. */
export const toCSSVariables = (componentName: string, values?: WebTokenValues | null) =>
    Object.entries(values ?? {}).reduce<Record<string, string>>(
        (acc, [key, value]) => ({ ...acc, [getCSSVariableName(componentName, key)]: value }),
        {},
    );

/**
 * Базовый конфиг компонента в ядре. Имя выводится из имени компонента (`Button` → `buttonConfig`),
 * как это делает генератор; исключения (`Skeleton` → `lineSkeletonConfig`) перечислены здесь,
 * зеркало поля `coreConfigExport` в манифестах генератора.
 */
const coreConfigNameByComponent: Record<string, string> = {
    Skeleton: 'lineSkeletonConfig',
};

export const getCoreConfig = (componentName: string) => {
    const name = coreConfigNameByComponent[componentName] ?? `${lowerFirstLetter(componentName)}Config`;

    return (plasmaCore as Record<string, unknown>)[name];
};
