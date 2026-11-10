/** План экспорта темы, который строит общий Kotlin-модуль `:plugins:figma-core` (`FigmaExportPlan`). */

/** Цвет 0–1 по каналам. */
export interface PlanColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

/** Значение переменной в одном режиме; ссылка указывает на ключ переменной плана или файла. */
export type PlanValue =
    | ({ kind: 'color' } & PlanColor)
    | { kind: 'alias'; key: string; opacity?: number }
    | { kind: 'number'; value: number }
    | { kind: 'string'; value: string };

export interface PlanMode {
    key: string;
    name: string;
}

export interface PlanVariable {
    key: string;
    name: string;
    type: 'COLOR' | 'FLOAT' | 'STRING';
    scopes: string[];
    values: Record<string, PlanValue>;
}

export interface PlanCollection {
    key: string;
    name: string;
    modes: PlanMode[];
    variables: PlanVariable[];
}

/** Поле текстового стиля, которое привязывается к переменной. */
export type TextBinding = 'fontSize' | 'lineHeight' | 'letterSpacing' | 'fontWeight' | 'fontFamily';

export interface PlanTextStyle {
    key: string;
    name: string;
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    bindings: Partial<Record<TextBinding, string>>;
}

export interface PlanShadow {
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: PlanColor;
    /** Переменная плана, к которой привязан цвет слоя. */
    colorKey?: string;
}

export interface PlanEffectStyle {
    key: string;
    name: string;
    shadows: PlanShadow[];
}

/** Стоп градиента; `key` — переменная плана, к которой привязан цвет. */
export interface PlanStop {
    position: number;
    color: PlanColor;
    key?: string;
}

/** Слой заливки; угол линейного градиента — в градусах CSS, `key` сплошного слоя привязывает цвет к переменной. */
export type PlanPaint =
    | { kind: 'solid'; color: PlanColor; key?: string }
    | { kind: 'linear'; angle: number; stops: PlanStop[] };

export interface PlanPaintStyle {
    key: string;
    name: string;
    /** Слои сверху вниз, как в CSS. */
    paints: PlanPaint[];
}

export interface PlanSkip {
    name: string;
    reason: string;
}

/** Файл начертания из значения токена `fontFamily`. */
export interface PlanFontFile {
    name: string;
    url: string;
    weight?: string;
    style?: string;
}

/** Файлы начертаний семейства, которое использует типографика. */
export interface PlanFontFamily {
    family: string;
    files: PlanFontFile[];
}

export interface ExportSource {
    themeName: string;
    tenantId: string;
    versionId: string | null;
    /** Дизайн-система плана; в плане старой версии ядра его нет. */
    designSystemId?: string;
}

export interface ExportPlan {
    source: ExportSource;
    collections: PlanCollection[];
    textStyles: PlanTextStyle[];
    effectStyles: PlanEffectStyle[];
    paintStyles: PlanPaintStyle[];
    skipped: PlanSkip[];
    omitted: { disabled: number };
    /** Ссылки на файлы шрифтов; в плане старой версии ядра их нет. */
    fontFiles?: PlanFontFamily[];
    /** Экспортированное с оговоркой, например градиент парой стилей; в плане старой версии ядра их нет. */
    notes?: PlanSkip[];
}

/** Число объектов каждого вида. */
export interface ExportCounts {
    collections: number;
    variables: number;
    textStyles: number;
    effectStyles: number;
    paintStyles: number;
}

/** Итог записи плана в документ. */
export interface ExportReport {
    source: ExportSource;
    created: ExportCounts;
    updated: ExportCounts;
    /** Объекты с ключом DS Builder, которых нет в плане: не удаляются. */
    stale: ExportCounts;
    skipped: PlanSkip[];
    /** Создано с оговоркой: показывается отдельно от пропусков. */
    notes: PlanSkip[];
    omitted: { disabled: number };
    /** Семейства шрифтов, которых нет в Figma: их текстовые стили пропущены. */
    missingFonts: string[];
    /** Файлы недостающих семейств для установки. */
    fontFiles: PlanFontFamily[];
    /** Причина, по которой запись прекратилась; созданное до неё остаётся. */
    failure?: string;
}
