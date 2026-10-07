import {
    hexToRgba,
    rampKey,
    resolveStepInGroup,
    rgbToHsl,
    sameRamp,
    SYSTEM_GROUPS,
    templateRampMeta,
    templateRampName,
    type PaletteGroup,
    type PaletteRamp,
    type PaletteRampRef,
    type ThemePalette,
} from '../../modules/palette';

export type PaletteMode = 'palette' | 'color';
export type PaletteFilter = 'all' | 'linked' | 'changed';

export interface PaletteSelection {
    groupId: string;
    slot: PaletteRampRef;
    step: number;
}

/** «1 палитра», «3 палитры», «7 палитр». */
export const countLabel = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const noun =
        mod10 === 1 && mod100 !== 11
            ? 'палитра'
            : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
              ? 'палитры'
              : 'палитр';
    return `${count} ${noun}`;
};

export const groupHelper = (group: PaletteGroup) =>
    SYSTEM_GROUPS.find((item) => item.key === group.systemKey)?.helper ?? 'Пользовательская группа.';

/** Подпись под именем растяжки, как `sourcePaletteDisplayIdentity` прототипа. */
export const rampMeta = (ramp: PaletteRamp) => {
    if (ramp.origin === 'rebuild' && ramp.anchor) {
        const color = hexToRgba(ramp.anchor.value);
        const hsl = color ? rgbToHsl(color) : null;
        return hsl && hsl.s >= 8 ? `Custom · Hue${hsl.h}` : 'Custom';
    }
    return `${templateRampMeta(ramp.source)}${ramp.modified ? ' · Изменена' : ''}`;
};

/** Подпись в боковой панели: «Green / Hue 130» для `additional`, имя для `general`. */
export const familyLabel = (ramp: PaletteRamp) => {
    const meta = rampMeta(ramp);
    return meta.startsWith('Hue') ? `${ramp.displayName} / ${meta.replace(/^Hue(\d+)/, 'Hue $1')}` : ramp.displayName;
};

export const isChanged = (ramp: PaletteRamp) => ramp.modified || !sameRamp(ramp.slot, ramp.source);

/** Все ступени палитры в порядке от светлой к тёмной; отсутствующие у растяжки показываются пустыми. */
export const displaySteps = (palette: ThemePalette) => {
    const steps = new Set<number>();
    for (const group of palette.groups) for (const ramp of group.ramps) for (const step of ramp.steps) steps.add(step.step);
    return [...steps].sort((a, b) => a - b);
};

export const stepOf = (ramp: PaletteRamp, step: number) => ramp.steps.find((item) => item.step === step);

export const middleStep = (ramp: Pick<PaletteRamp, 'steps'>) => {
    const steps = ramp.steps.map((item) => item.step);
    if (steps.includes(500)) return 500;
    return steps[Math.floor(steps.length / 2)] ?? 500;
};

/** Ступень при выборе растяжки: прежняя, если она есть у растяжки, иначе средняя. */
export const selectionStep = (ramp: Pick<PaletteRamp, 'steps'>, step: number | undefined) =>
    step !== undefined && ramp.steps.some((item) => item.step === step) ? step : middleStep(ramp);

/** Группы с растяжками после поиска и фильтра. */
export const filterGroups = (palette: ThemePalette, search: string, filter: PaletteFilter) => {
    const query = search.trim().toLowerCase();
    return palette.groups
        .map((group) => ({
            group,
            ramps: group.ramps.filter((ramp) => {
                if (filter === 'linked' && ramp.linkedCount === 0) return false;
                if (filter === 'changed' && !isChanged(ramp)) return false;
                if (!query) return true;
                const haystack = [
                    group.label,
                    ramp.displayName,
                    rampMeta(ramp),
                    rampKey(ramp.slot),
                    rampKey(ramp.source),
                    ...ramp.steps.flatMap((step) => [String(step.step), step.value]),
                ]
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(query);
            }),
        }))
        // Без поиска и фильтра видны все группы, в том числе пустые: в них можно добавить палитру.
        .filter(({ ramps }) => ramps.length > 0 || (!query && filter === 'all'));
};

/**
 * Растяжки шаблона для списков выбора («Поменять», «Добавить палитру», замена при удалении): как в прототипе,
 * сначала серые семейства, затем остальные в порядке шаблона. Порядок шаблона в контракте не меняется.
 */
export const libraryOrder = <T extends PaletteRampRef>(ramps: T[]) => {
    const neutral = (ramp: PaletteRampRef) => (ramp.type === 'general' && /gray$/i.test(ramp.shade) ? 0 : 1);
    return [...ramps].sort((a, b) => neutral(a) - neutral(b));
};

export const templateLabel = (ref: PaletteRampRef) => ({ name: templateRampName(ref), meta: templateRampMeta(ref) });

/** Значение ссылки токена, если бы токен принадлежал группе `groupId`. */
export const valueInGroup = (palette: ThemePalette, groupId: string, reference: PaletteRampRef & { step: number }) =>
    resolveStepInGroup(palette, groupId, reference);

export const findRamp = (palette: ThemePalette, groupId: string, slot: PaletteRampRef) =>
    palette.groups.find((group) => group.id === groupId)?.ramps.find((ramp) => sameRamp(ramp.slot, slot));
