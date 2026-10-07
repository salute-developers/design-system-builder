import { SYSTEM_GROUPS } from './groups';
import type { PaletteAnchor, PaletteErrorCode, PaletteRampRef, PaletteTemplate, SystemGroupKey } from './types';

/** Хранимое состояние палитры темы: то же, что таблицы `tenant_palette_*` в ds-service. */
export interface StoredGroup {
    id: string;
    kind: 'system' | 'custom';
    systemKey: SystemGroupKey | null;
    label: string;
}

export interface StoredRamp {
    groupId: string;
    slot: PaletteRampRef;
    source: PaletteRampRef;
    added: boolean;
    origin: 'template' | 'rebuild';
    anchor: PaletteAnchor | null;
    /** Правки ступеней: ступень → HEX. */
    steps: Record<string, string>;
}

export interface PaletteState {
    version: 1;
    editRevision: number;
    template: PaletteTemplate;
    groups: StoredGroup[];
    ramps: StoredRamp[];
    /** Только явные привязки: tokenId → groupId. */
    tokenGroups: Record<string, string>;
}

export class PaletteOperationError extends Error {
    readonly status: 400 | 404 | 409 | null;
    readonly code: PaletteErrorCode | null;
    readonly details?: Record<string, unknown>;

    constructor(
        status: 400 | 404 | 409 | null,
        code: PaletteErrorCode | null,
        message: string,
        details?: Record<string, unknown>,
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

/** Новое состояние палитры темы: копия шаблона и системные группы. */
export const createPaletteState = (template: PaletteTemplate, newId: () => string): PaletteState => ({
    version: 1,
    editRevision: 0,
    template: JSON.parse(JSON.stringify(template)) as PaletteTemplate,
    groups: SYSTEM_GROUPS.map((group) => ({
        id: newId(),
        kind: 'system',
        systemKey: group.key,
        label: group.label,
    })),
    ramps: [],
    tokenGroups: {},
});

export const systemGroupId = (state: PaletteState, key: SystemGroupKey) =>
    state.groups.find((group) => group.systemKey === key)!.id;
