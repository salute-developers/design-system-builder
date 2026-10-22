import type { PaletteRampRef } from '../../palette';
import { colorField, emptyField, sameValue, type PaletteColorResolver } from './field';
import { COLOR_CONTEXTS, COLOR_MODES, contextSubgroup, inheritedMode, parseMemberName, tokenId } from './family';
import { NATIVE_PLATFORMS, type NativePlatform } from './nativeGradient';
import { validateColorValue } from './validation';
import type {
    ColorContext,
    ColorFieldValue,
    ColorMode,
    ColorTokenKey,
    ColorTokenType,
    ColorTokenView,
    TokenPlacement,
} from './types';

/** Определение темы, из которого строится экран: имя с режимом и значения платформ. */
export interface ThemeTokenSource {
    name: string;
    type: ColorTokenType;
    displayName: string;
    description?: string;
    enabled: boolean;
    web: unknown;
    ios?: unknown;
    android?: unknown;
    /** Свои значения платформ: `true` — значение задано отдельно, а не построено из web. */
    overridden?: Partial<Record<NativePlatform, boolean>>;
}

export interface ViewDeps {
    resolve: PaletteColorResolver;
    /** Место определения (имя без режима) в группах токенов или `null`, если определения нет на сервере. */
    placement: (memberName: string) => TokenPlacement | null;
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

/**
 * Токены экрана из определений темы: семейство — группа и имя независимо от типа; состояния `-hover`, `-active`,
 * `-brightness` в строки не попадают.
 */
export const buildColorTokenViews = (tokens: ThemeTokenSource[], deps: ViewDeps): ColorTokenView[] => {
    const byName = new Map(tokens.map((token) => [token.name, token]));
    const families = new Map<string, ColorTokenKey>();
    tokens.forEach((token) => {
        const parsed = parseMemberName(token.name);
        if (!parsed || parsed.state) return;
        const key: ColorTokenKey = { group: parsed.group, name: parsed.name };
        const id = tokenId(key);
        if (!families.has(id)) families.set(id, key);
    });

    return [...families.values()].map((key) => {
        const field = (mode: ColorMode, subgroup: string): ColorFieldValue | null => {
            const name = `${mode}.${key.group}.${subgroup}.${key.name}`;
            const token = byName.get(name);
            if (!token) return null;
            // Строки своих значений есть только у платформ с признаком `overridden`.
            const platforms = NATIVE_PLATFORMS.filter((platform) => token.overridden?.[platform]).map((platform) => [
                platform,
                colorField(token[platform], name, deps.resolve, deps.rampName, platform),
            ]);
            return {
                ...colorField(token.web, name, deps.resolve, deps.rampName),
                platforms: Object.fromEntries(platforms),
            };
        };
        const modes = Object.fromEntries(
            COLOR_MODES.map((mode) => [mode, field(mode, 'default') ?? emptyField()]),
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
        const placement = deps.placement(defaultName);
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
            const message = validateColorValue(value);
            return message ? [{ field: name, message }] : [];
        });

        const view: ColorTokenView = {
            key,
            id: tokenId(key),
            type: source?.type ?? 'color',
            displayName:
                source?.displayName && source.displayName !== source.name ? source.displayName : camelName(key),
            description: source?.description ?? '',
            groupId: placement?.groupId ?? null,
            position: placement?.position ?? 0,
            publishedIn: placement?.publishedIn ?? null,
            enabled: source?.enabled ?? true,
            incomplete,
            modes,
            contexts,
            issues,
        };
        return view;
    });
};
