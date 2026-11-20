import type { PaletteRampRef } from '../../palette';
import { colorField, emptyField, type PaletteColorResolver } from './field';
import {
    COLOR_CONTEXTS,
    COLOR_MODES,
    COLOR_STATES,
    STATE_LABELS,
    contextSubgroup,
    hasStateFormula,
    inheritedMode,
    parseMemberName,
    stateRowId,
    tokenId,
} from './family';
import { NATIVE_PLATFORMS, type NativePlatform } from './nativeGradient';
import { validateColorValue } from './validation';
import type {
    ColorContext,
    ColorFieldValue,
    ColorMode,
    ColorState,
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
    /** Связь подтемы с режимом явно разорвана: такая подтема не связана, даже если значения совпадают. */
    detached?: boolean;
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
 * Токены экрана из определений темы: семейство — группа и имя независимо от типа. Состояния `-hover`, `-active`,
 * `-brightness` становятся отдельными видами в `states` своего токена, если у состояния есть определение подгруппы
 * `default`.
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

    const build = (key: ColorTokenKey, state: ColorState | null): ColorTokenView => {
        const suffix = state ? `-${state}` : '';
        const memberOf = (subgroup: string) => `${key.group}.${subgroup}.${key.name}${suffix}`;
        const field = (mode: ColorMode, subgroup: string): ColorFieldValue | null => {
            const name = `${mode}.${memberOf(subgroup)}`;
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
                // Связь хранится только признаком `detached`: подтема связана, пока её не отвязали явно, даже если
                // значения сида отличаются от режимов. Правка Light или Dark переносит в неё значения режима.
                const linked = COLOR_MODES.every((mode) => !byName.get(`${mode}.${memberOf(subgroup)}`)?.detached);
                return [context, { linked, values }];
            }),
        ) as Record<ColorContext, { linked: boolean; values: Record<ColorMode, ColorFieldValue> }>;

        const defaultName = memberOf('default');
        const baseName = `${key.group}.default.${key.name}`;
        const source = byName.get(`dark.${baseName}`) ?? byName.get(`light.${baseName}`);
        const own = byName.get(`dark.${defaultName}`) ?? byName.get(`light.${defaultName}`);
        const placement = deps.placement(baseName);
        const memberNames = [defaultName, ...COLOR_CONTEXTS.map((it) => memberOf(contextSubgroup(key.group, it)))];
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
        const displayName =
            source?.displayName && source.displayName !== source.name ? source.displayName : camelName(key);

        const view: ColorTokenView = {
            key,
            id: state ? stateRowId(key, state) : tokenId(key),
            type: (own ?? source)?.type ?? 'color',
            displayName: state ? `${displayName}${STATE_LABELS[state]}` : displayName,
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
        if (!state) return view;
        const formulaAvailable = hasStateFormula(key.group);
        // Ручное значение — признак `detached` у значений подгруппы `default` состояния.
        const manual = COLOR_MODES.some((mode) => byName.get(`${mode}.${defaultName}`)?.detached);
        return { ...view, state, formulaAvailable, formula: formulaAvailable && !manual };
    };

    return [...families.values()].map((key) => ({
        ...build(key, null),
        states: COLOR_STATES.filter((state) =>
            COLOR_MODES.some((mode) => byName.has(`${mode}.${key.group}.default.${key.name}-${state}`)),
        ).map((state) => build(key, state)),
    }));
};

/**
 * Строка токена для платформы предпросмотра: поля режимов и подтем берут своё значение iOS или Android, а без него
 * остаются значением Web, из которого платформа строится.
 */
export const viewForPlatform = (view: ColorTokenView, platform: NativePlatform | 'web'): ColorTokenView => {
    const at = (field: ColorFieldValue): ColorFieldValue => {
        // У Web своих значений нет: поле остаётся значением Web.
        const own = field.platforms[platform as NativePlatform];
        return own ? { ...own, platforms: field.platforms } : field;
    };
    return {
        ...view,
        modes: { light: at(view.modes.light), dark: at(view.modes.dark) },
        contexts: Object.fromEntries(
            Object.entries(view.contexts).map(([context, item]) => [
                context,
                { ...item, values: { light: at(item.values.light), dark: at(item.values.dark) } },
            ]),
        ) as ColorTokenView['contexts'],
        ...(view.states ? { states: view.states.map((state) => viewForPlatform(state, platform)) } : {}),
    };
};
