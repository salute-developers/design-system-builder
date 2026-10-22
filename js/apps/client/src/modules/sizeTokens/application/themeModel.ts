import {
    AndroidShadow,
    AndroidShape,
    AndroidSpacing,
    IOSShadow,
    IOSShape,
    IOSSpacing,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    WebShadow,
    WebShape,
    WebSpacing,
} from '../../../controllers';
import type { Theme } from '../../../controllers';
import {
    THEME_TOKEN_TYPE,
    themeValuesFromToken,
    themeValuesFromWritten,
    type SizeToken,
    type WrittenValue,
} from '../domain';

/** Модель темы, в которую переносятся значения подтверждённых операций. */
export type ThemeModel = Pick<Theme, 'getToken' | 'addToken' | 'removeToken'>;
type PlatformValues = Partial<Record<WrittenValue['platform'], unknown>>;

const PLATFORMS = ['web', 'ios', 'android'] as const;

/** Новый токен модели темы со значениями трёх платформ. */
const createThemeToken = (token: SizeToken, values: PlatformValues) => {
    const meta = { name: token.name, tags: token.name.split('.'), displayName: token.name, enabled: true };
    const value = (platform: (typeof PLATFORMS)[number]) => values[platform] as never;
    if (token.kind === 'radius')
        return new ShapeToken(meta, {
            web: new WebShape(value('web')),
            ios: new IOSShape(value('ios')),
            android: new AndroidShape(value('android')),
        });
    if (token.kind === 'spacing')
        return new SpacingToken(meta, {
            web: new WebSpacing(value('web')),
            ios: new IOSSpacing(value('ios')),
            android: new AndroidSpacing(value('android')),
        });
    return new ShadowToken(meta, {
        web: new WebShadow(value('web')),
        ios: new IOSShadow(value('ios')),
        android: new AndroidShadow(value('android')),
    });
};

const writeValues = (theme: ThemeModel, token: SizeToken, values: PlatformValues) => {
    const type = THEME_TOKEN_TYPE[token.kind];
    const existing = theme.getToken(token.name, type);
    if (!existing) {
        if (PLATFORMS.every((platform) => values[platform] !== undefined))
            theme.addToken(type, createThemeToken(token, values) as never);
        return;
    }
    PLATFORMS.forEach((platform) => {
        if (values[platform] !== undefined) existing.setValue(platform, values[platform] as never);
    });
};

/**
 * Значения токена в модели темы после изменения: другие разделы видят новое значение без перезагрузки темы.
 * Без записанных значений они строятся по токену в формате чтения. У тени значения всегда строятся по токену: в
 * записанных значениях цвет слоя может быть ссылкой на палитру, а модели темы нужен раскрытый цвет для CSS.
 */
export const applyToTheme = (theme: ThemeModel, token: SizeToken, written?: readonly WrittenValue[]) => {
    const values =
        token.kind !== 'shadow' && written?.length
            ? themeValuesFromWritten(token.kind, written)
            : themeValuesFromToken(token);
    if (values) writeValues(theme, token, values);
};

/** Убирает удалённые токены из модели темы. */
export const removeFromTheme = (theme: ThemeModel, tokens: readonly SizeToken[]) =>
    tokens.forEach((token) => theme.removeToken(token.name, THEME_TOKEN_TYPE[token.kind]));
