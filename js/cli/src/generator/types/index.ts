// TODO: забирать из отдельного пакета
import { Meta } from '../componentBuilder/index.ts';

export interface BaseFileStructure {
    pathToDir: string;
    packageName: string;
    packageVersion: string;
    coreVersion: string;
    hasComponents: boolean;
    /** По умолчанию `true`: пакет собирается с темой. */
    hasTheme?: boolean;
}

export interface ComponentsFiles {
    pathToDir: string;
    componentsMeta: Meta[];
    /** Будет ли в пакете тема: без неё компоненты с `requiresTheme` пропускаются. По умолчанию — будет. */
    hasTheme?: boolean;
}

/**
 * Манифест компонента: `templates/<Component>/component.json`. То, что знает только
 * генератор и не выводится из данных ДС: имена экспортов ядра, если они не `<x>Tokens` /
 * `<x>Config` (`tabsTokens` у Tabs, `lineSkeletonConfig` у Skeleton), и форма обёртки.
 */
export interface ComponentManifest {
    coreTokensExport?: string;
    coreConfigExport?: string;
    /** Имя типа пропсов из ядра: результат `component(...)` приводится к `ForwardRefExoticComponent<Props & RefAttributes<HTMLDivElement>>`. */
    castToProps?: string;
    /**
     * Обёртка берёт данные из темы пакета (ViewContainer: наборы переменных `viewContainer`). Без темы в пакете
     * компонент не генерируется, генератор печатает предупреждение.
     */
    requiresTheme?: boolean;
    /**
     * Вид по точкам перелома (Grid: `getBaseGridView`): в стиль с значениями web-параметров, оканчивающихся на
     * `paramSuffix`, генератор вставляет вызов функции ядра `function` с этими значениями и именем стиля, как sdds-serv.
     * Медиазапрос не берёт ширину из CSS-переменной, поэтому функции нужны готовые значения ДС.
     */
    breakpointView?: { function: string; paramSuffix: string };
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
