import type { PaletteRampRef } from '../../palette';
import { colorField, sameValue, type PaletteColorResolver } from './field';
import { COLOR_CONTEXTS, COLOR_MODES, contextSubgroup, inheritedMode, parseMemberName, tokenId } from './family';
import { categoryOf, paletteCategoryLabel, sectionOf } from './sections';
import { validateColorValue } from './validation';
import type { ColorContext, ColorFieldValue, ColorMode, ColorTokenKey, ColorTokenType, ColorTokenView } from './types';

/** Определение темы, из которого строится экран: имя с режимом и web-значение. */
export interface ThemeTokenSource {
    name: string;
    type: ColorTokenType;
    displayName: string;
    description?: string;
    enabled: boolean;
    web: unknown;
}

export interface PaletteCategory {
    id: string;
    systemKey: string | null;
    label: string;
}

export interface ViewDeps {
    resolve: PaletteColorResolver;
    /** Группа палитры определения (имя без режима) или `null` без палитры. */
    paletteGroup: (memberName: string) => PaletteCategory | null;
    /** Имена определений без режима, у которых нет значений в теме. */
    incomplete: ReadonlySet<string>;
    /** Имя растяжки ссылки в группе определения, как на экране палитры. */
    rampName?: (reference: PaletteRampRef, tokenName: string) => string;
}

const camelName = (key: ColorTokenKey) =>
    key.group +
    key.name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

/** Токены экрана из определений темы: состояния `-hover`, `-active`, `-brightness` в строки не попадают. */
export const buildColorTokenViews = (tokens: ThemeTokenSource[], deps: ViewDeps): ColorTokenView[] => {
    const byName = new Map(tokens.map((token) => [token.name, token]));
    const families = new Map<string, { key: ColorTokenKey; index: number }>();
    tokens.forEach((token, index) => {
        const parsed = parseMemberName(token.name);
        if (!parsed || parsed.state) return;
        const key: ColorTokenKey = { type: token.type, group: parsed.group, name: parsed.name };
        const id = tokenId(key);
        if (!families.has(id)) families.set(id, { key, index });
    });

    return [...families.values()].flatMap(({ key, index }) => {
        const section = sectionOf(key);
        if (!section) return [];
        const field = (mode: ColorMode, subgroup: string): ColorFieldValue | null => {
            const name = `${mode}.${key.group}.${subgroup}.${key.name}`;
            const token = byName.get(name);
            return token ? colorField(token.web, key.type, name, deps.resolve, deps.rampName) : null;
        };
        const empty = (): ColorFieldValue => ({ value: '', resolved: 'transparent', paletteLabel: null, opacity: 1 });
        const modes = Object.fromEntries(
            COLOR_MODES.map((mode) => [mode, field(mode, 'default') ?? empty()]),
        ) as Record<ColorMode, ColorFieldValue>;
        const contexts = Object.fromEntries(
            COLOR_CONTEXTS.map((context) => {
                const subgroup = contextSubgroup(key.group, context);
                const values = Object.fromEntries(
                    COLOR_MODES.map((mode) => [mode, field(mode, subgroup) ?? modes[inheritedMode(context, mode)]]),
                ) as Record<ColorMode, ColorFieldValue>;
                const linked = COLOR_MODES.every((mode) =>
                    sameValue(values[mode], modes[inheritedMode(context, mode)]),
                );
                return [context, { linked, values }];
            }),
        ) as Record<ColorContext, { linked: boolean; values: Record<ColorMode, ColorFieldValue> }>;

        const defaultName = `${key.group}.default.${key.name}`;
        const source = byName.get(`dark.${defaultName}`) ?? byName.get(`light.${defaultName}`);
        const group = key.type === 'color' ? deps.paletteGroup(defaultName) : null;
        const memberNames = [
            defaultName,
            ...COLOR_CONTEXTS.map((it) => `${key.group}.${contextSubgroup(key.group, it)}.${key.name}`),
        ];
        const incomplete =
            memberNames.some((name) => deps.incomplete.has(name)) ||
            COLOR_MODES.some((mode) => memberNames.some((name) => !byName.has(`${mode}.${name}`)));
        const fields = [
            ...COLOR_MODES.map((mode) => ({ name: mode as string, value: modes[mode] })),
            ...COLOR_CONTEXTS.flatMap((context) =>
                COLOR_MODES.map((mode) => ({ name: `${context}-${mode}`, value: contexts[context].values[mode] })),
            ),
        ];
        const issues = fields.flatMap(({ name, value }) => {
            const message = validateColorValue(value, key.type);
            return message ? [{ field: name, message }] : [];
        });

        const view: ColorTokenView = {
            key,
            id: tokenId(key),
            displayName:
                source?.displayName && source.displayName !== source.name ? source.displayName : camelName(key),
            description: source?.description ?? '',
            section,
            category: categoryOf(key, section, group ? paletteCategoryLabel(group.systemKey, group.label) : null),
            paletteGroupId: group?.id ?? null,
            sourceIndex: index,
            enabled: source?.enabled ?? true,
            incomplete,
            modes,
            contexts,
            issues,
        };
        return [view];
    });
};
