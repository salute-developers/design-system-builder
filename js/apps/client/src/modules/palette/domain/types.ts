/**
 * DTO контракта палитры темы. Совпадают с контрактом `add-theme-palette-api` в ds-service.
 */
export type PaletteType = 'general' | 'additional';

export type SystemGroupKey = 'neutral' | 'accent' | 'status' | 'data' | 'syntax';

export interface PaletteRampRef {
    type: PaletteType;
    shade: string;
}

export interface PaletteAnchor {
    step: number;
    value: string;
}

export interface PaletteStep {
    step: number;
    value: string;
    templateValue: string;
    overridden: boolean;
    linkedCount: number;
}

export interface PaletteRamp {
    slot: PaletteRampRef;
    source: PaletteRampRef;
    displayName: string;
    origin: 'template' | 'rebuild';
    anchor: PaletteAnchor | null;
    added: boolean;
    modified: boolean;
    linkedCount: number;
    steps: PaletteStep[];
}

export interface PaletteGroup {
    id: string;
    kind: 'system' | 'custom';
    systemKey: SystemGroupKey | null;
    label: string;
    ramps: PaletteRamp[];
}

export interface PaletteTokenAssignment {
    tokenId: string;
    tokenName: string;
    groupId: string;
    assignment: 'explicit' | 'default';
}

/** Растяжка копии шаблона темы: источник для «Добавить палитру» и «Поменять». */
export interface PaletteTemplateRamp {
    type: PaletteType;
    shade: string;
    steps: { step: number; value: string }[];
}

export interface ThemePalette {
    tenantId: string;
    editRevision: number;
    canEdit: boolean;
    offBrand: boolean;
    groups: PaletteGroup[];
    tokens: PaletteTokenAssignment[];
    template: PaletteTemplateRamp[];
}

export interface PaletteLink {
    tokenId: string;
    tokenName: string;
    displayName: string | null;
    groupId: string;
    mode: string | null;
    step: number;
    opacity: number | null;
    platforms: string[];
}

export interface RebuildPreview {
    steps: { step: number; value: string }[];
}

export type PaletteErrorCode =
    | 'PALETTE_GROUP_EXISTS'
    | 'PALETTE_GROUP_SYSTEM'
    | 'PALETTE_RAMP_EXISTS'
    | 'PALETTE_RAMP_LINKED'
    | 'PALETTE_STEP_MISSING'
    | 'TENANT_EDIT_CONFLICT';

/** Копия шаблона палитры: `type.shade` → ступень → HEX. */
export type PaletteTemplate = Record<string, Record<string, string>>;
