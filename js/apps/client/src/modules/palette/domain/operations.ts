import { isHexColor, toUpperHex } from './color';
import { rebuildRamp } from './rebuild';
import { formatPaletteReference, parsePaletteReference, rampKey, sameRamp, withOpacity } from './reference';
import { isDraftTokenId } from './groups';
import { PaletteOperationError, systemGroupId, type PaletteState, type StoredGroup, type StoredRamp } from './state';
import type { SlotLink } from './build';
import type { PaletteLink, PaletteRampRef, ThemePalette } from './types';

/**
 * Операции над палитрой темы — та же семантика, что у API `ds-service`. Каждая функция чистая:
 * возвращает новое состояние или бросает `PaletteOperationError`.
 */
export interface OperationContext {
    palette: ThemePalette;
    links: SlotLink[];
    newId: () => string;
}

export interface OperationResult<T> {
    state: PaletteState;
    value: T;
}

/** Переписывание ссылок токенов группы при удалении растяжки. */
export interface TokenReferenceRewrite {
    tokenIds: string[];
    from: PaletteRampRef;
    to: PaletteRampRef | 'detach';
}

const clone = (state: PaletteState): PaletteState => JSON.parse(JSON.stringify(state)) as PaletteState;

const bump = (state: PaletteState) => ({ ...state, editRevision: state.editRevision + 1 });

const notFound = (message: string) => new PaletteOperationError(404, null, message);

const findGroup = (state: PaletteState, groupId: string): StoredGroup => {
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) throw notFound('Группа палитры не найдена');
    return group;
};

const templateSteps = (state: PaletteState, ref: PaletteRampRef) => {
    const steps = state.template[rampKey(ref)];
    if (!steps) throw notFound(`Растяжки ${rampKey(ref)} нет в палитре темы`);
    return steps;
};

const rampInGroup = (palette: ThemePalette, groupId: string, slot: PaletteRampRef) =>
    palette.groups.find((group) => group.id === groupId)?.ramps.find((ramp) => sameRamp(ramp.slot, slot));

const requireRamp = (palette: ThemePalette, groupId: string, slot: PaletteRampRef) => {
    const ramp = rampInGroup(palette, groupId, slot);
    if (!ramp) throw notFound('Растяжки нет в группе');
    return ramp;
};

const storedRamp = (state: PaletteState, groupId: string, slot: PaletteRampRef): StoredRamp => {
    const existing = state.ramps.find((ramp) => ramp.groupId === groupId && sameRamp(ramp.slot, slot));
    if (existing) return existing;
    const created: StoredRamp = {
        groupId,
        slot,
        source: slot,
        added: false,
        origin: 'template',
        anchor: null,
        steps: {},
    };
    state.ramps.push(created);
    return created;
};

const usedSteps = (links: PaletteLink[]) => [...new Set(links.map((link) => link.step))].sort((a, b) => a - b);

const linksOf = (links: SlotLink[], groupId: string, slot: PaletteRampRef) =>
    links.filter((link) => link.groupId === groupId && sameRamp(link.slot, slot));

const missingSteps = (state: PaletteState, source: PaletteRampRef, links: PaletteLink[]) => {
    const steps = templateSteps(state, source);
    const missing = usedSteps(links).filter((step) => steps[String(step)] === undefined);
    if (missing.length)
        throw new PaletteOperationError(409, 'PALETTE_STEP_MISSING', 'В новой растяжке нет используемых ступеней', {
            steps: missing,
        });
};

const groupLabel = (state: PaletteState, label: string, exceptId?: string) => {
    const trimmed = label.trim();
    if (!trimmed || trimmed.length > 64)
        throw new PaletteOperationError(400, null, 'Название группы должно содержать от 1 до 64 символов');
    if (state.groups.some((group) => group.id !== exceptId && group.label.toLowerCase() === trimmed.toLowerCase()))
        throw new PaletteOperationError(409, 'PALETTE_GROUP_EXISTS', `Группа «${trimmed}» уже есть`);
    return trimmed;
};

/** Свободное имя новой группы: «Новая группа», «Новая группа 2», … */
export const nextGroupLabel = (groups: { label: string }[], base = 'Новая группа') => {
    const taken = new Set(groups.map((group) => group.label.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    let index = 2;
    while (taken.has(`${base} ${index}`.toLowerCase())) index += 1;
    return `${base} ${index}`;
};

export const createGroup = (state: PaletteState, label: string, ctx: OperationContext): OperationResult<StoredGroup> => {
    const trimmed = groupLabel(state, label);
    const next = clone(state);
    const group: StoredGroup = { id: ctx.newId(), kind: 'custom', systemKey: null, label: trimmed };
    next.groups.push(group);
    return { state: bump(next), value: group };
};

export const renameGroup = (state: PaletteState, groupId: string, label: string): OperationResult<StoredGroup> => {
    const group = findGroup(state, groupId);
    if (group.kind === 'system')
        throw new PaletteOperationError(409, 'PALETTE_GROUP_SYSTEM', 'Системную группу нельзя переименовать');
    const trimmed = groupLabel(state, label, groupId);
    const next = clone(state);
    const renamed = findGroup(next, groupId);
    renamed.label = trimmed;
    return { state: bump(next), value: renamed };
};

export const deleteGroup = (state: PaletteState, groupId: string, ctx: OperationContext): OperationResult<void> => {
    const group = findGroup(state, groupId);
    if (group.kind === 'system')
        throw new PaletteOperationError(409, 'PALETTE_GROUP_SYSTEM', 'Системную группу нельзя удалить');
    const next = clone(state);
    const neutralId = systemGroupId(next, 'neutral');
    // Состав neutral — хранимые растяжки и слоты из связей токенов; при совпадении остаётся растяжка neutral.
    const neutralSlots = new Set(
        (ctx.palette.groups.find((item) => item.id === neutralId)?.ramps ?? []).map((ramp) => rampKey(ramp.slot)),
    );
    next.ramps = next.ramps.flatMap((ramp) => {
        if (ramp.groupId !== groupId) return [ramp];
        if (neutralSlots.has(rampKey(ramp.slot))) return [];
        return [{ ...ramp, groupId: neutralId }];
    });
    next.groups = next.groups.filter((item) => item.id !== groupId);
    next.tokenGroups = Object.fromEntries(Object.entries(next.tokenGroups).filter(([, id]) => id !== groupId));
    return { state: bump(next), value: undefined };
};

export const assignTokenGroup = (
    state: PaletteState,
    tokenId: string,
    groupId: string | null,
    ctx: OperationContext,
): OperationResult<{ tokenId: string; groupId: string | null }> => {
    if (!ctx.palette.tokens.some((token) => token.tokenId === tokenId)) throw notFound('Цветовой токен не найден');
    // Id токена черновика временный: привязка потерялась бы после сохранения или переименования токена.
    if (isDraftTokenId(tokenId))
        throw new PaletteOperationError(400, null, 'Сохраните токен, чтобы задать ему группу палитры');
    if (groupId !== null) findGroup(state, groupId);
    const next = clone(state);
    if (groupId === null) delete next.tokenGroups[tokenId];
    else next.tokenGroups[tokenId] = groupId;
    return { state: bump(next), value: { tokenId, groupId } };
};

export const addRamp = (
    state: PaletteState,
    groupId: string,
    slot: PaletteRampRef,
    ctx: OperationContext,
): OperationResult<PaletteRampRef> => {
    findGroup(state, groupId);
    templateSteps(state, slot);
    if (rampInGroup(ctx.palette, groupId, slot))
        throw new PaletteOperationError(409, 'PALETTE_RAMP_EXISTS', 'Растяжка уже есть в группе');
    const next = clone(state);
    next.ramps.push({ groupId, slot, source: slot, added: true, origin: 'template', anchor: null, steps: {} });
    return { state: bump(next), value: slot };
};

export const replaceSource = (
    state: PaletteState,
    groupId: string,
    slot: PaletteRampRef,
    source: PaletteRampRef,
    ctx: OperationContext,
): OperationResult<PaletteRampRef> => {
    findGroup(state, groupId);
    requireRamp(ctx.palette, groupId, slot);
    missingSteps(state, source, linksOf(ctx.links, groupId, slot));
    const next = clone(state);
    const ramp = storedRamp(next, groupId, slot);
    Object.assign(ramp, { source, steps: {}, origin: 'template', anchor: null });
    return { state: bump(next), value: slot };
};

export const rebuildPreview = (
    state: PaletteState,
    groupId: string,
    slot: PaletteRampRef,
    anchorStep: number,
    value: string,
    ctx: OperationContext,
) => {
    findGroup(state, groupId);
    const ramp = requireRamp(ctx.palette, groupId, slot);
    if (!isHexColor(value)) throw new PaletteOperationError(400, null, 'Некорректный HEX опорного цвета');
    const source = templateSteps(state, ramp.source);
    const values = rebuildRamp(source, anchorStep, toUpperHex(value));
    if (!values) throw new PaletteOperationError(400, null, `У источника нет ступени ${anchorStep}`);
    return values;
};

export const rebuild = (
    state: PaletteState,
    groupId: string,
    slot: PaletteRampRef,
    anchorStep: number,
    value: string,
    ctx: OperationContext,
): OperationResult<PaletteRampRef> => {
    const values = rebuildPreview(state, groupId, slot, anchorStep, value, ctx);
    const next = clone(state);
    const ramp = storedRamp(next, groupId, slot);
    Object.assign(ramp, { steps: values, origin: 'rebuild', anchor: { step: anchorStep, value: toUpperHex(value) } });
    return { state: bump(next), value: slot };
};

export const updateStep = (
    state: PaletteState,
    groupId: string,
    slot: PaletteRampRef,
    step: number,
    value: string,
    ctx: OperationContext,
): OperationResult<PaletteRampRef> => {
    findGroup(state, groupId);
    const ramp = requireRamp(ctx.palette, groupId, slot);
    if (!isHexColor(value)) throw new PaletteOperationError(400, null, 'Некорректный HEX');
    if (!ramp.steps.some((item) => item.step === step)) throw notFound(`У растяжки нет ступени ${step}`);
    const next = clone(state);
    const stored = storedRamp(next, groupId, slot);
    const hex = toUpperHex(value);
    const sourceValue = next.template[rampKey(stored.source)]?.[String(step)];
    if (stored.origin === 'template' && sourceValue && toUpperHex(sourceValue) === hex) {
        // Значение источника — это сброс правки, а не новая правка: иначе «Изменена» и «вне бренда» не снять.
        // Запись растяжки остаётся: по ней растяжка может держаться в группе; признаки считаются по правкам.
        delete stored.steps[String(step)];
        return { state: bump(next), value: slot };
    }
    stored.steps[String(step)] = hex;
    if (stored.origin === 'rebuild' && stored.anchor?.step === step) stored.anchor = { step, value: hex };
    return { state: bump(next), value: slot };
};

export const removeRamp = (
    state: PaletteState,
    groupId: string,
    slot: PaletteRampRef,
    input: { strategy?: 'replace' | 'detach'; replacement?: PaletteRampRef },
    ctx: OperationContext,
): OperationResult<{ reassigned: number; rewrite: TokenReferenceRewrite | null }> => {
    findGroup(state, groupId);
    requireRamp(ctx.palette, groupId, slot);
    const linked = linksOf(ctx.links, groupId, slot);
    if (linked.length && !input.strategy)
        throw new PaletteOperationError(409, 'PALETTE_RAMP_LINKED', 'У растяжки есть связанные токены');
    if (input.strategy === 'replace') {
        if (!input.replacement) throw new PaletteOperationError(400, null, 'Не выбрана растяжка замены');
        missingSteps(state, input.replacement, linked);
    }
    const next = clone(state);
    next.ramps = next.ramps.filter((ramp) => !(ramp.groupId === groupId && sameRamp(ramp.slot, slot)));
    if (input.strategy === 'replace' && input.replacement) {
        const replacement = input.replacement;
        if (!next.ramps.some((ramp) => ramp.groupId === groupId && sameRamp(ramp.slot, replacement)))
            next.ramps.push({
                groupId,
                slot: replacement,
                source: replacement,
                added: true,
                origin: 'template',
                anchor: null,
                steps: {},
            });
    }
    const rewrite: TokenReferenceRewrite | null = linked.length
        ? {
              tokenIds: [...new Set(linked.map((link) => link.tokenId))],
              from: slot,
              to: input.strategy === 'replace' ? input.replacement! : 'detach',
          }
        : null;
    return { state: bump(next), value: { reassigned: linked.length, rewrite } };
};

/**
 * Новое значение токена при удалении растяжки: ссылка на ту же ступень замены или вычисленный HEX.
 * Возвращает `undefined`, если значение не ссылается на убираемый слот.
 */
export const rewriteTokenValue = (
    value: unknown,
    rewrite: TokenReferenceRewrite,
    resolveHex: (step: number) => string | undefined,
): string | undefined => {
    const reference = parsePaletteReference(value);
    if (!reference || !sameRamp(reference, rewrite.from)) return undefined;
    if (rewrite.to === 'detach') {
        const hex = resolveHex(reference.step);
        return hex ? withOpacity(hex, reference.opacity) : undefined;
    }
    return formatPaletteReference({ ...reference, type: rewrite.to.type, shade: rewrite.to.shade });
};
