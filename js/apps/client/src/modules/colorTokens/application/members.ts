import type { Theme, Token } from '../../../controllers';
import { COLOR_MODES, parseMemberName, type ColorMode, type ColorTokenKey } from '../domain';
import type { ColorPlatform, ColorTokenValueItem } from './colorTokenRepository';
import type { PendingUpdate } from './autosave';

/** Определение дизайн-системы: имя без режима → идентификатор и тип. */
export type TokenDefinitions = Map<string, { id: string; type: string }>;

/** Признак своего значения платформы определения темы (имя с режимом). */
export type OverriddenLookup = (themeName: string, platform: Exclude<ColorPlatform, 'web'>) => boolean;

const PLATFORMS: readonly ColorPlatform[] = ['web', 'ios', 'android'];
const TOKEN_TYPES = ['color', 'gradient'] as const;

/** Значение платформы в форме сервера: строка — массив из одной строки, массив слоёв — как есть. */
export const wireValue = (value: unknown) => (Array.isArray(value) ? value : [value]);

/** Определение темы по имени с режимом в списке цветов или градиентов: тип в поиск не входит. */
export const findColorToken = (theme: Pick<Theme, 'getToken'>, name: string): Token | undefined =>
    TOKEN_TYPES.map((type) => theme.getToken(name, type) as unknown as Token | undefined).find(Boolean);

/** Определения темы, входящие в семейство токена, из списков цветов и градиентов. */
export const familyTokens = (theme: Pick<Theme, 'getTokens'>, key: ColorTokenKey): Token[] =>
    TOKEN_TYPES.flatMap((type) => theme.getTokens(type) as unknown as Token[]).filter((token) => {
        const parsed = parseMemberName(token.getName());
        return parsed !== null && parsed.group === key.group && parsed.name === key.name;
    });

/** Определения семейства по имени члена без режима: члены, у которых в теме есть оба режима. */
const membersByName = (theme: Pick<Theme, 'getTokens'>, key: ColorTokenKey) => {
    const byMember = new Map<string, Partial<Record<ColorMode, Token>>>();
    for (const token of familyTokens(theme, key)) {
        const parsed = parseMemberName(token.getName());
        if (!parsed?.mode) continue;
        const member = token.getName().slice(parsed.mode.length + 1);
        byMember.set(member, { ...byMember.get(member), [parsed.mode]: token });
    }
    return [...byMember.entries()].flatMap(([name, modes]) =>
        COLOR_MODES.every((mode) => modes[mode]) ? [{ name, modes: modes as Record<ColorMode, Token> }] : [],
    );
};

const memberValues = (modes: Record<ColorMode, Token>, overridden?: OverriddenLookup): ColorTokenValueItem[] =>
    COLOR_MODES.flatMap((mode) =>
        PLATFORMS.map((platform) => ({
            platform,
            mode,
            paletteId: null,
            value: wireValue(modes[mode].getValue(platform as never)),
            ...(overridden ? { overridden: platform !== 'web' && overridden(modes[mode].getName(), platform) } : {}),
        })),
    );

/**
 * Члены семейства для операции создания со значениями трёх платформ из темы — для токенов, которые есть в
 * теме, но ещё не созданы на сервере (прежний черновик): градиенты сохраняют нативные значения ios и android.
 */
export const familyCreateMembers = (theme: Pick<Theme, 'getTokens'>, key: ColorTokenKey) =>
    membersByName(theme, key).map(({ name, modes }) => ({ name, values: memberValues(modes) }));

/**
 * Тело операции изменения значений: все определения семейства, у которых в теме есть оба режима, с значениями
 * трёх платформ и признаком своего значения. `null`, если у семейства нет сохранённых определений.
 */
export const familyUpdate = (
    theme: Pick<Theme, 'getTokens'>,
    key: ColorTokenKey,
    definitions: TokenDefinitions,
    overridden: OverriddenLookup = () => false,
): PendingUpdate | null => {
    const members = membersByName(theme, key).flatMap(({ name, modes }) => {
        const definition = definitions.get(name);
        return definition ? [{ tokenId: definition.id, values: memberValues(modes, overridden) }] : [];
    });
    const defaultId = definitions.get(`${key.group}.default.${key.name}`)?.id ?? members[0]?.tokenId;
    return defaultId && members.length ? { tokenId: defaultId, update: { members } } : null;
};
