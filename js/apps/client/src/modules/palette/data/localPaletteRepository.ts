import {
    buildThemePalette,
    createPaletteState,
    paletteOperations,
    PaletteOperationError,
    sameRamp,
    type PaletteGroup,
    type PaletteRamp,
    type PaletteRampRef,
    type PaletteState,
    type PaletteTemplate,
    type PaletteTokenRef,
    type PaletteTokenValue,
    type ThemePaletteModel,
    type TokenReferenceRewrite,
} from '../domain';
import type { PaletteContext, PaletteMutation, PaletteRepository } from '../application/paletteRepository';

export interface LocalThemeInput {
    tokens: PaletteTokenRef[];
    values: PaletteTokenValue[];
    canEdit: boolean;
}

export interface LocalPaletteDeps {
    storage: Pick<Storage, 'getItem' | 'setItem'>;
    newId: () => string;
    /** Шаблон, который копируется в тему при первом открытии палитры. */
    template: () => PaletteTemplate;
    /** Токены и значения открытой темы, включая черновик. */
    theme: (ctx: PaletteContext) => LocalThemeInput;
    /**
     * Записывает переписанные ссылки токенов в черновик темы атомарно: при ошибке ничего не меняет и бросает её,
     * при успехе возвращает отмену записи.
     */
    applyRewrite: (
        ctx: PaletteContext,
        rewrite: TokenReferenceRewrite,
        resolveHex: (step: number) => string | undefined,
    ) => (() => void) | void;
}

export const localPaletteKey = ({ projectId, designSystemId, tenantId }: PaletteContext) =>
    `ds_palette:${projectId}:${designSystemId}:${tenantId}`;

/** Адаптер `local`: палитра темы в `localStorage` с той же семантикой, что у API `ds-service`. */
export const createLocalPaletteRepository = (deps: LocalPaletteDeps): PaletteRepository => {
    const read = (ctx: PaletteContext): PaletteState => {
        const raw = deps.storage.getItem(localPaletteKey(ctx));
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as PaletteState;
                if (parsed.version === 1) return parsed;
            } catch {
                // повреждённое состояние заменяется новой копией шаблона
            }
        }
        const created = createPaletteState(deps.template(), deps.newId);
        deps.storage.setItem(localPaletteKey(ctx), JSON.stringify(created));
        return created;
    };

    const model = (ctx: PaletteContext, state: PaletteState): ThemePaletteModel => {
        const theme = deps.theme(ctx);
        return buildThemePalette({ tenantId: ctx.tenantId, canEdit: theme.canEdit, state, tokens: theme.tokens, values: theme.values });
    };

    const mutate = <R, T>(
        ctx: PaletteContext,
        editRevision: number,
        operation: (state: PaletteState, current: ThemePaletteModel) => { state: PaletteState; value: R },
        present: (value: R, next: ThemePaletteModel, current: ThemePaletteModel) => T,
        /** Побочная запись вне состояния палитры (черновик токенов); возвращает её отмену. */
        effect?: (value: R, current: ThemePaletteModel) => (() => void) | void,
    ): PaletteMutation<T> => {
        const state = read(ctx);
        const current = model(ctx, state);
        if (!current.palette.canEdit) throw new PaletteOperationError(null, null, 'Нет права изменять палитру темы');
        if (editRevision !== state.editRevision)
            throw new PaletteOperationError(409, 'TENANT_EDIT_CONFLICT', 'Тема изменена в другом месте', {
                editRevision: state.editRevision,
            });
        const result = operation(state, current);
        // Сначала черновик, потом палитра: если палитру записать не удалось, запись черновика откатывается.
        const undo = effect?.(result.value, current);
        try {
            deps.storage.setItem(localPaletteKey(ctx), JSON.stringify(result.state));
        } catch (error) {
            undo?.();
            throw error;
        }
        return { editRevision: result.state.editRevision, value: present(result.value, model(ctx, result.state), current) };
    };

    const context = (current: ThemePaletteModel) => ({ palette: current.palette, links: current.links, newId: deps.newId });

    const findRamp = (next: ThemePaletteModel, groupId: string, slot: PaletteRampRef): PaletteRamp =>
        next.palette.groups.find((group) => group.id === groupId)!.ramps.find((ramp) => sameRamp(ramp.slot, slot))!;

    const findGroup = (next: ThemePaletteModel, groupId: string): PaletteGroup =>
        next.palette.groups.find((group) => group.id === groupId)!;

    return {
        source: 'local',
        load: async (ctx) => model(ctx, read(ctx)).palette,
        links: async (ctx, { slot, groupId, step }) =>
            model(ctx, read(ctx))
                .links.filter(
                    (link) =>
                        sameRamp(link.slot, slot) &&
                        (groupId === undefined || link.groupId === groupId) &&
                        (step === undefined || link.step === step),
                )
                .map(({ tokenId, tokenName, displayName, groupId: linkGroup, mode, step: linkStep, opacity, platforms }) => ({
                    tokenId,
                    tokenName,
                    displayName,
                    groupId: linkGroup,
                    mode,
                    step: linkStep,
                    opacity,
                    platforms,
                })),
        createGroup: async (ctx, label, editRevision) =>
            mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.createGroup(state, label, context(current)),
                (group, next) => findGroup(next, group.id),
            ),
        renameGroup: async (ctx, groupId, label, editRevision) =>
            mutate(
                ctx,
                editRevision,
                (state) => paletteOperations.renameGroup(state, groupId, label),
                (group, next) => findGroup(next, group.id),
            ),
        deleteGroup: async (ctx, groupId, editRevision) =>
            mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.deleteGroup(state, groupId, context(current)),
                () => undefined,
            ),
        assignTokenGroup: async (ctx, tokenId, groupId, editRevision) =>
            mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.assignTokenGroup(state, tokenId, groupId, context(current)),
                (_, next) => next.palette.tokens.find((token) => token.tokenId === tokenId)!,
            ),
        addRamp: async (ctx, groupId, slot, editRevision) =>
            mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.addRamp(state, groupId, slot, context(current)),
                (_, next) => findRamp(next, groupId, slot),
            ),
        replaceSource: async (ctx, groupId, slot, source, editRevision) =>
            mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.replaceSource(state, groupId, slot, source, context(current)),
                (_, next) => findRamp(next, groupId, slot),
            ),
        rebuild: async (ctx, groupId, slot, { anchorStep, value, preview, editRevision }) => {
            if (preview) {
                const state = read(ctx);
                const current = model(ctx, state);
                const values = paletteOperations.rebuildPreview(state, groupId, slot, anchorStep, value, context(current));
                return {
                    steps: Object.entries(values)
                        .map(([step, hex]) => ({ step: Number(step), value: hex }))
                        .sort((a, b) => a.step - b.step),
                };
            }
            return mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.rebuild(state, groupId, slot, anchorStep, value, context(current)),
                (_, next) => findRamp(next, groupId, slot),
            );
        },
        updateStep: async (ctx, groupId, slot, step, value, editRevision) =>
            mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.updateStep(state, groupId, slot, step, value, context(current)),
                (_, next) => findRamp(next, groupId, slot),
            ),
        removeRamp: async (ctx, groupId, slot, { strategy, replacement, editRevision }) =>
            mutate(
                ctx,
                editRevision,
                (state, current) => paletteOperations.removeRamp(state, groupId, slot, { strategy, replacement }, context(current)),
                (result) => ({ reassigned: result.reassigned }),
                (result, current) => {
                    if (!result.rewrite) return undefined;
                    const removed = findRamp(current, groupId, slot);
                    return deps.applyRewrite(ctx, result.rewrite, (step) =>
                        removed.steps.find((item) => item.step === step)?.value,
                    );
                },
            ),
    };
};

