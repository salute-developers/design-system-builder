import { defaultGroupForToken, stripModePrefix } from './groups';
import { parsePaletteReference, sameRamp, type PaletteReference } from './reference';
import type { PaletteRampRef, ThemePalette } from './types';

type StepRef = PaletteRampRef & { step: number };

const templateValue = (palette: ThemePalette, ref: StepRef) =>
    palette.template.find((ramp) => sameRamp(ramp, ref))?.steps.find((step) => step.step === ref.step)?.value;

/**
 * Значение ступени слота в группе: экземпляр растяжки группы, а если слота в группе нет — копия шаблона темы.
 * Именно это значение получит токен группы, ссылающийся на слот.
 */
export const resolveStepInGroup = (palette: ThemePalette, groupId: string, ref: StepRef) => {
    const ramp = palette.groups.find((group) => group.id === groupId)?.ramps.find((item) => sameRamp(item.slot, ref));
    return ramp?.steps.find((step) => step.step === ref.step)?.value ?? templateValue(palette, ref);
};

const assignmentsByName = new WeakMap<ThemePalette, Map<string, ThemePalette['tokens'][number]>>();

export const resolvePaletteTokenGroup = (palette: ThemePalette, tokenName: string) => {
    let byName = assignmentsByName.get(palette);
    if (!byName) {
        byName = new Map(palette.tokens.map((item) => [item.tokenName, item]));
        assignmentsByName.set(palette, byName);
    }
    return byName.get(stripModePrefix(tokenName));
};

/** Группа токена: явная или по умолчанию; для токена, неизвестного палитре, — по правилу имени. */
export const resolveTokenGroupId = (palette: ThemePalette, tokenName: string) =>
    resolvePaletteTokenGroup(palette, tokenName)?.groupId ??
    palette.groups.find((group) => group.systemKey === defaultGroupForToken(tokenName))?.id;

/**
 * Значение ссылки по палитре темы для токена `tokenName` — по его группе (для неизвестного палитре токена —
 * по правилу имени). Без имени токена — копия шаблона темы: записываемое значение не должно зависеть от
 * правок произвольной группы. Возвращает HEX без прозрачности или `undefined`, если ссылку нельзя разрешить.
 */
export const resolvePaletteStep = (
    palette: ThemePalette,
    value: unknown,
    tokenName?: string,
): { hex: string; opacity: PaletteReference['opacity'] } | undefined => {
    const reference = parsePaletteReference(value);
    if (!reference) return undefined;
    const groupId = tokenName ? resolveTokenGroupId(palette, tokenName) : undefined;
    const hex = groupId ? resolveStepInGroup(palette, groupId, reference) : templateValue(palette, reference);
    return hex ? { hex, opacity: reference.opacity } : undefined;
};
