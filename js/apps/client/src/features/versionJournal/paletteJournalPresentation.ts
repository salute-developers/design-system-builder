import type { DraftChangeDto } from '../../api/editorContracts';
import { templateRampName } from '../../modules/palette/domain/names';
import type { JournalChangedField } from './journalFields';

export interface JournalPaletteStep {
    step: number;
    before?: string;
    after?: string;
}

interface PaletteJournalPresentation {
    title: string;
    groupLabel?: string;
    fields: JournalChangedField[];
    paletteSteps?: JournalPaletteStep[];
}

const rampName = (value: Record<string, unknown>, prefix: 'slot' | 'source') => {
    const type = value[`${prefix}_type`];
    const shade = value[`${prefix}_shade`];
    return (type === 'general' || type === 'additional') && typeof shade === 'string'
        ? templateRampName({ type, shade })
        : undefined;
};

const colors = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(
            (entry): entry is [string, string] => /^\d+$/.test(entry[0]) && typeof entry[1] === 'string',
        ),
    );
};

/** Палитра описывается действиями редактора, а не полями предметных таблиц. */
export const presentPaletteChange = (
    change: DraftChangeDto,
    names: Map<string, string>,
): PaletteJournalPresentation | undefined => {
    if (change.entityType !== 'palette-ramp' && change.entityType !== 'palette-step') return undefined;
    const before = change.previousValue ?? {};
    const after = change.currentValue ?? {};
    const location = change.currentValue ?? change.previousValue ?? {};
    const name = rampName(location, 'slot') ?? 'Без названия';
    const groupLabel =
        typeof location.group_label === 'string' ? location.group_label : names.get(String(location.group_id));
    const fields: JournalChangedField[] = [];
    const add = (path: string, label: string, oldValue: unknown, newValue: unknown) => {
        if (oldValue === newValue) return;
        fields.push({
            path,
            label,
            before: oldValue as string | number | undefined,
            after: newValue as string | number | undefined,
        });
    };
    if (change.entityType === 'palette-step') {
        add('/value', 'Цвет', before.value, after.value);
        return { title: `Ступень палитры: ${name} ${location.step ?? ''}`.trim(), groupLabel, fields };
    }
    const rebuilt = after.origin === 'rebuild';
    add('/source', 'Исходная растяжка', rampName(before, 'source'), rampName(after, 'source'));
    add('/anchor_step', 'Опорная ступень', before.anchor_step ?? undefined, after.anchor_step ?? undefined);
    add('/anchor_value', 'Цвет для перестроения', before.anchor_value ?? undefined, after.anchor_value ?? undefined);
    const previousColors = colors(before.steps);
    const currentColors = colors(after.steps);
    const paletteSteps: JournalPaletteStep[] = [
        ...new Set([...Object.keys(previousColors), ...Object.keys(currentColors)]),
    ]
        .map((step) => ({ step: Number(step), before: previousColors[step], after: currentColors[step] }))
        .sort((left, right) => left.step - right.step);
    return {
        title: `${rebuilt ? 'Перестроение растяжки' : 'Растяжка палитры'}: ${name}`,
        groupLabel,
        fields,
        paletteSteps: paletteSteps.length ? paletteSteps : undefined,
    };
};
