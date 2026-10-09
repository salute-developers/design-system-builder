import type {
    PaletteGroup,
    PaletteLink,
    PaletteRamp,
    PaletteRampRef,
    PaletteTokenAssignment,
    RebuildPreview,
    ThemePalette,
} from '../domain';

export interface PaletteContext {
    projectId: string;
    designSystemId: string;
    tenantId: string;
}

export interface PaletteLinksQuery {
    slot: PaletteRampRef;
    groupId?: string;
    step?: number;
}

export interface RebuildInput {
    anchorStep: number;
    value: string;
    preview: boolean;
    editRevision: number;
}

export interface RemoveRampInput {
    strategy?: 'replace' | 'detach';
    replacement?: PaletteRampRef;
    editRevision: number;
}

export interface PaletteMutation<T> {
    editRevision: number;
    value: T;
}

/**
 * Порт палитры темы. Повторяет контракт API палитры `ds-service` (`add-theme-palette-api`);
 * реализуется HTTP-адаптером и локальным адаптером в браузере.
 */
export interface PaletteRepository {
    readonly source: 'api' | 'local';
    load(ctx: PaletteContext, signal?: AbortSignal): Promise<ThemePalette>;
    links(ctx: PaletteContext, query: PaletteLinksQuery): Promise<PaletteLink[]>;
    createGroup(ctx: PaletteContext, label: string, editRevision: number): Promise<PaletteMutation<PaletteGroup>>;
    renameGroup(ctx: PaletteContext, groupId: string, label: string, editRevision: number): Promise<PaletteMutation<PaletteGroup>>;
    deleteGroup(ctx: PaletteContext, groupId: string, editRevision: number): Promise<PaletteMutation<void>>;
    assignTokenGroup(
        ctx: PaletteContext,
        tokenId: string,
        groupId: string | null,
        editRevision: number,
    ): Promise<PaletteMutation<PaletteTokenAssignment>>;
    addRamp(
        ctx: PaletteContext,
        groupId: string,
        slot: PaletteRampRef,
        editRevision: number,
    ): Promise<PaletteMutation<PaletteRamp>>;
    replaceSource(
        ctx: PaletteContext,
        groupId: string,
        slot: PaletteRampRef,
        source: PaletteRampRef,
        editRevision: number,
    ): Promise<PaletteMutation<PaletteRamp>>;
    rebuild(
        ctx: PaletteContext,
        groupId: string,
        slot: PaletteRampRef,
        input: RebuildInput,
    ): Promise<PaletteMutation<PaletteRamp> | RebuildPreview>;
    updateStep(
        ctx: PaletteContext,
        groupId: string,
        slot: PaletteRampRef,
        step: number,
        value: string,
        editRevision: number,
    ): Promise<PaletteMutation<PaletteRamp>>;
    removeRamp(
        ctx: PaletteContext,
        groupId: string,
        slot: PaletteRampRef,
        input: RemoveRampInput,
    ): Promise<PaletteMutation<{ reassigned: number }>>;
}

export const isRebuildPreview = (value: PaletteMutation<PaletteRamp> | RebuildPreview): value is RebuildPreview =>
    'steps' in value && !('editRevision' in value);
