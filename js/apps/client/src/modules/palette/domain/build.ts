import { defaultGroupForToken, SYSTEM_GROUPS } from './groups';
import { rampDisplayName } from './names';
import { compareRamps, parsePaletteReference, parseRampKey, rampKey, sameRamp } from './reference';
import { systemGroupId, type PaletteState, type StoredRamp } from './state';
import type { PaletteGroup, PaletteLink, PaletteRamp, PaletteRampRef, PaletteTokenAssignment, ThemePalette } from './types';

/** Цветовой токен дизайн-системы (имя без префикса режима). */
export interface PaletteTokenRef {
    id: string;
    name: string;
    displayName: string | null;
}

/** Цветовое значение токена темы. */
export interface PaletteTokenValue {
    tokenId: string;
    mode: string | null;
    platform: string;
    value: unknown;
}

export interface ThemePaletteInput {
    tenantId: string;
    canEdit: boolean;
    state: PaletteState;
    tokens: PaletteTokenRef[];
    values: PaletteTokenValue[];
}

/** Связь токена со слотом; внутри клиента несёт сам слот, в DTO `PaletteLink` его нет. */
export type SlotLink = PaletteLink & { slot: PaletteRampRef };

export interface ThemePaletteModel {
    palette: ThemePalette;
    links: SlotLink[];
}

const stepsOf = (template: PaletteState['template'], ref: PaletteRampRef) => template[rampKey(ref)];

export const assignTokens = (state: PaletteState, tokens: PaletteTokenRef[]): PaletteTokenAssignment[] => {
    const groupIds = new Set(state.groups.map((group) => group.id));
    return tokens.map((token) => {
        const explicit = state.tokenGroups[token.id];
        return explicit && groupIds.has(explicit)
            ? { tokenId: token.id, tokenName: token.name, groupId: explicit, assignment: 'explicit' }
            : {
                  tokenId: token.id,
                  tokenName: token.name,
                  groupId: systemGroupId(state, defaultGroupForToken(token.name)),
                  assignment: 'default',
              };
    });
};

/** Связи токенов со слотами: уникальны по `(tokenId, mode, slot, step)`, платформы собираются. */
export const collectLinks = (
    state: PaletteState,
    tokens: PaletteTokenRef[],
    values: PaletteTokenValue[],
    assignments = assignTokens(state, tokens),
): SlotLink[] => {
    const tokenById = new Map(tokens.map((token) => [token.id, token]));
    const groupByToken = new Map(assignments.map((item) => [item.tokenId, item.groupId]));
    const links = new Map<string, SlotLink>();

    for (const value of values) {
        const token = tokenById.get(value.tokenId);
        const reference = parsePaletteReference(value.value);
        if (!token || !reference) continue;
        const source = stepsOf(state.template, reference);
        if (!source || source[String(reference.step)] === undefined) continue;
        const key = [token.id, value.mode ?? '', rampKey(reference), reference.step].join('|');
        const existing = links.get(key);
        if (existing) {
            if (!existing.platforms.includes(value.platform)) existing.platforms.push(value.platform);
            continue;
        }
        links.set(key, {
            tokenId: token.id,
            tokenName: token.name,
            displayName: token.displayName,
            groupId: groupByToken.get(token.id)!,
            mode: value.mode,
            step: reference.step,
            opacity: reference.opacity,
            platforms: [value.platform],
            slot: { type: reference.type, shade: reference.shade },
        });
    }
    return [...links.values()];
};

const pairCount = (links: PaletteLink[]) => new Set(links.map((link) => `${link.tokenId}|${link.mode ?? ''}`)).size;

const defaultRamp = (groupId: string, slot: PaletteRampRef): StoredRamp => ({
    groupId,
    slot,
    source: slot,
    added: false,
    origin: 'template',
    anchor: null,
    steps: {},
});

const buildRamp = (
    state: PaletteState,
    stored: StoredRamp,
    links: SlotLink[],
): PaletteRamp | null => {
    const source = stepsOf(state.template, stored.source);
    const slotSteps = stepsOf(state.template, stored.slot);
    if (!source || !slotSteps) return null;
    const rampLinks = links.filter((link) => sameRamp(link.slot, stored.slot));
    // Ссылка токена указывает на ступень слота, поэтому у растяжки только ступени слота, которые есть у источника.
    const steps = Object.keys(source)
        .filter((step) => slotSteps[step] !== undefined)
        .map(Number)
        .sort((a, b) => a - b)
        .map((step) => {
            const templateValue = source[String(step)];
            const override = stored.steps[String(step)];
            return {
                step,
                value: override ?? templateValue,
                templateValue,
                overridden: override !== undefined,
                linkedCount: pairCount(rampLinks.filter((link) => link.step === step)),
            };
        });
    return {
        slot: stored.slot,
        source: stored.source,
        displayName: rampDisplayName(stored.source, stored.origin === 'rebuild' ? stored.anchor : null),
        origin: stored.origin,
        anchor: stored.anchor,
        added: stored.added,
        modified: Object.keys(stored.steps).length > 0,
        linkedCount: pairCount(rampLinks),
        steps,
    };
};

const groupOrder = (state: PaletteState) => {
    const system = SYSTEM_GROUPS.map((definition) => state.groups.find((group) => group.systemKey === definition.key)!);
    return [...system, ...state.groups.filter((group) => group.kind === 'custom')];
};

/** Собирает палитру темы: группы, состав, значения ступеней и связи. */
export const buildThemePalette = ({ tenantId, canEdit, state, tokens, values }: ThemePaletteInput): ThemePaletteModel => {
    const assignments = assignTokens(state, tokens);
    const links = collectLinks(state, tokens, values, assignments);

    const groups: PaletteGroup[] = groupOrder(state).map((group) => {
        const groupLinks = links.filter((link) => link.groupId === group.id);
        const stored = new Map(
            state.ramps.filter((ramp) => ramp.groupId === group.id).map((ramp) => [rampKey(ramp.slot), ramp]),
        );
        for (const link of groupLinks)
            if (!stored.has(rampKey(link.slot))) stored.set(rampKey(link.slot), defaultRamp(group.id, link.slot));
        const ramps = [...stored.values()]
            .sort((a, b) => compareRamps(a.slot, b.slot))
            .map((ramp) => buildRamp(state, ramp, groupLinks))
            .filter((ramp): ramp is PaletteRamp => ramp !== null);
        return { id: group.id, kind: group.kind, systemKey: group.systemKey, label: group.label, ramps };
    });

    const offBrand = state.ramps.some((ramp) => Object.keys(ramp.steps).length > 0 || !sameRamp(ramp.slot, ramp.source));

    return {
        palette: {
            tenantId,
            editRevision: state.editRevision,
            canEdit,
            offBrand,
            groups,
            tokens: assignments,
            template: templateRamps(state).map((ref) => ({
                ...ref,
                steps: Object.entries(state.template[rampKey(ref)])
                    .map(([step, value]) => ({ step: Number(step), value }))
                    .sort((a, b) => a.step - b.step),
            })),
        },
        links,
    };
};

/** Ступени растяжки шаблона в порядке от светлой к тёмной. */
export const templateRamps = (state: Pick<PaletteState, 'template'>) =>
    Object.keys(state.template)
        .map(parseRampKey)
        .sort(compareRamps);
