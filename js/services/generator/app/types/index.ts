import { FastifyReply } from 'fastify';

// TODO: забирать из отдельного пакета
import { Meta } from '../componentBuilder';
import { ThemeSource } from '../themeBuilder/types';

type ExportType = 'tgz' | 'zip' | 'source';

export interface DesignSystemData {
    packageName: string;
    packageVersion: string;
    componentsData: Meta[];
    themeData: ThemeSource;
}

export interface OutputParams {
    pathToDir: string;
    coreVersion: string;
    exportType: ExportType;
}

export interface GenerateRouteBody {
    packageName: string;
    packageVersion: string;
    exportType: ExportType;
    // componentsMeta: Meta[];
    // themeSource: ThemeSource;
    npmToken: string;
}

export interface BaseFileStructure {
    pathToDir: string;
    packageName: string;
    packageVersion: string;
    coreVersion: string;
    hasComponents: boolean;
}

export interface ComponentsFiles {
    pathToDir: string;
    componentsMeta: Meta[];
}

export interface ThemeFiles {
    pathToDir: string;
    packageName: string;
    packageVersion: string;
    themeSource: ThemeSource;
}

export interface GenerateRouteBodyResponse {
    packageName: string;
    packageVersion: string;
    pathToDir: string;
    reply: FastifyReply;
}

/**
 * Манифест компонента: `app/templates/<Component>/component.json`. То, что знает только
 * генератор и не выводится из данных ДС: имена экспортов ядра, если они не `<x>Tokens` /
 * `<x>Config` (`tabsTokens` у Tabs, `lineSkeletonConfig` у Skeleton), и форма обёртки.
 */
export interface ComponentManifest {
    coreTokensExport?: string;
    coreConfigExport?: string;
    /** Имя типа пропсов из ядра: результат `component(...)` приводится к `ForwardRefExoticComponent<Props & RefAttributes<HTMLDivElement>>`. */
    castToProps?: string;
    /**
     * Реэкспорты из `@salutejs/plasma-new-hope/styled-components` в `index.ts` компонента,
     * как в sdds-serv: подкомпоненты и утилиты ядра (`CardContent`, `modalClasses`,
     * `PopupProvider`) и типы (`CardProps`).
     */
    reexports?: {
        runtime?: string[];
        types?: string[];
        /** Типы, которые объявляет сама обёртка: пока только `<X>Props = ComponentProps<typeof <X>>`. */
        localTypes?: string[];
        /** Типы из корня `@salutejs/plasma-new-hope` (`SelectItemOption`), их нет в styled-components. */
        coreTypes?: string[];
        /** Что ещё экспортирует сама обёртка из шаблона (`ToastProvider`, `NotificationsProvider`). */
        local?: string[];
    };
    /**
     * Дженерик-обёртка (Select, Combobox, Dropdown): `fixedForwardRef` сохраняет параметр типа
     * элемента списка. `propsType` и `itemType` — из корня `@salutejs/plasma-new-hope`,
     * `refElement` — тип DOM-узла для ref.
     */
    generic?: {
        propsType: string;
        itemType: string;
        refElement: string;
    };
    /** Соседи из той же обёртки без конфига темы (ToolbarDivider, DrawerContent): пустые обёртки рядом. */
    siblings?: { name: string; coreConfigExport: string }[];
    /**
     * Несколько appearance. Два вида обёртки:
     * - `{ prop, default }` (Tabs): у каждого appearance свой базовый конфиг ядра `<appearance><X>Config`,
     *   обёртка выбирает пару по пропу `prop`, имя appearance равно значению пропа;
     * - `{ conditional: true }` (Range): базовый конфиг ядра один, обёртка — `createConditionalComponent`
     *   ядра по пропу `appearance`; конфиг темы `default` лежит в `<X>.config.ts`, остальные в `<X>.<имя>.config.ts`.
     *   Неизвестное значение `appearance` ядро откатывает к `default`, а тип пропа его не пропустит.
     */
    appearances?: { prop: string; default: string } | { conditional: true };
}
