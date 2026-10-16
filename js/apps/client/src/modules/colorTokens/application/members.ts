import type { Theme, Token } from '../../../controllers';
import { COLOR_MODES, parseMemberName, type ColorMode, type ColorTokenKey } from '../domain';
import type { ColorPlatform, ColorTokenValueItem } from './colorTokenRepository';
import type { PendingUpdate } from './autosave';

/** Определение дизайн-системы: имя без режима → идентификатор и тип. */
export type TokenDefinitions = Map<string, { id: string; type: string }>;

const PLATFORMS: readonly ColorPlatform[] = ['web', 'ios', 'android'];

/** Значение платформы в форме сервера: цвет — массив из одной строки, градиент — как есть. */
const wireValue = (key: ColorTokenKey, value: unknown) =>
    key.type === 'gradient' || Array.isArray(value) ? value : [value];

/** Определения темы, входящие в семейство токена. */
export const familyTokens = (theme: Pick<Theme, 'getTokens'>, key: ColorTokenKey): Token[] =>
    (theme.getTokens(key.type) as unknown as Token[]).filter((token) => {
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

const memberValues = (key: ColorTokenKey, modes: Record<ColorMode, Token>): ColorTokenValueItem[] =>
    COLOR_MODES.flatMap((mode) =>
        PLATFORMS.map((platform) => ({
            platform,
            mode,
            paletteId: null,
            value: wireValue(key, modes[mode].getValue(platform as never)),
        })),
    );

/**
 * Члены семейства для операции создания со значениями трёх платформ из темы — для токенов, которые есть в
 * теме, но ещё не созданы на сервере (прежний черновик): градиенты сохраняют нативные значения ios и android.
 */
export const familyCreateMembers = (theme: Pick<Theme, 'getTokens'>, key: ColorTokenKey) =>
    membersByName(theme, key).map(({ name, modes }) => ({ name, values: memberValues(key, modes) }));

/**
 * Тело операции изменения значений: все определения семейства, у которых в теме есть оба режима, с значениями
 * трёх платформ. `null`, если у семейства нет сохранённых определений.
 */
export const familyUpdate = (
    theme: Pick<Theme, 'getTokens'>,
    key: ColorTokenKey,
    definitions: TokenDefinitions,
): PendingUpdate | null => {
    const members = membersByName(theme, key).flatMap(({ name, modes }) => {
        const definition = definitions.get(name);
        return definition ? [{ tokenId: definition.id, values: memberValues(key, modes) }] : [];
    });
    const defaultId = definitions.get(`${key.group}.default.${key.name}`)?.id ?? members[0]?.tokenId;
    return defaultId && members.length ? { tokenId: defaultId, update: { members } } : null;
};
