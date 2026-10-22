import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/editorReads', () => ({ readEditor: vi.fn(), invalidateEditorReads: vi.fn() }));

import { AndroidColor, ColorToken, IOSColor, Theme, WebColor } from '../../controllers';
import {
    buildColorTokenViews,
    readPaint,
    type ColorTokenRepository,
    type ColorTokenView,
    type Paint,
    type TokenGroupRepository,
} from '../../modules/colorTokens';
import {
    adoptTheme,
    colorTokenSession,
    createColorTokenEditor,
    isOverridden,
    setColorTokenRepository,
    type ColorTokenSession,
} from './colorTokenEditor';

const NAMES = ['text.default.accent', 'text.default.accent-hover', 'text.default.accent-active'];
const VALUES: Record<string, string> = { light: '#118833', dark: '#22AA44' };

const token = (name: string, value: string) =>
    new ColorToken(
        { name, tags: name.split('.'), displayName: name, enabled: true },
        { web: new WebColor(value), ios: new IOSColor(value), android: new AndroidColor(value) },
    );

let tenant = 0;
const repository = {
    create: vi.fn<ColorTokenRepository['create']>(),
    updateValues: vi.fn<ColorTokenRepository['updateValues']>(),
    delete: vi.fn<ColorTokenRepository['delete']>(),
    move: vi.fn<ColorTokenRepository['move']>(),
};

/** Сессия темы с токеном `text.accent` и его состояниями `-hover` и `-active`. */
const setup = (names: string[] = NAMES, valueOf = (mode: 'light' | 'dark', _name: string) => VALUES[mode]) => {
    setColorTokenRepository(repository, {} as TokenGroupRepository);
    const theme = new Theme('tenant', '1.0.0', {
        color: (['light', 'dark'] as const).flatMap((mode) =>
            names.map((name) => token(`${mode}.${name}`, valueOf(mode, name))),
        ),
        gradient: [],
        shape: [],
        shadow: [],
        spacing: [],
        typography: [],
        fontFamily: [],
    } as never);
    const session = colorTokenSession({ projectId: 'p', designSystemId: 'ds', tenantId: `t-${++tenant}` });
    session.designSystem = { getName: () => 'System', getParameters: () => ({ editRevision: 0 }) } as never;
    names.forEach((name, index) => session.definitions.set(name, { id: `id-${index}`, type: 'color' }));
    adoptTheme(session, theme);
    return { session, theme, editor: createColorTokenEditor(session) };
};

const viewOf = (session: ColorTokenSession): ColorTokenView =>
    buildColorTokenViews(
        (['color', 'gradient'] as const).flatMap((type) =>
            session.theme!.getTokens(type).map((item) => ({
                name: item.getName(),
                type,
                displayName: item.getDisplayName(),
                enabled: true,
                web: item.getValue('web' as never),
                ios: item.getValue('ios' as never),
                android: item.getValue('android' as never),
                overridden: {
                    ios: isOverridden(session, item.getName(), 'ios'),
                    android: isOverridden(session, item.getName(), 'android'),
                },
            })),
        ),
        { resolve: (value) => value, placement: () => null, incomplete: new Set() },
    )[0];

const value = (session: ColorTokenSession, name: string, platform: string) =>
    session.theme!.getToken(name, 'color')?.getValue(platform as never) ??
    session.theme!.getToken(name, 'gradient')?.getValue(platform as never);

afterEach(() => vi.clearAllMocks());

describe('редактор цветовых токенов: вид значения и платформы', () => {
    it('градиент режима копируется в -hover и -active, iOS и Android строятся из web', () => {
        const { session, editor } = setup();
        const paint = readPaint(['linear-gradient(45deg, #000000 0%, #FFFFFF 100%)'], 'web') as Paint;

        editor.setPaint(viewOf(session), 'dark', 'web', paint);

        for (const name of NAMES) {
            expect(value(session, `dark.${name}`, 'web')).toEqual(['linear-gradient(45deg, #000000 0%, #FFFFFF 100%)']);
            expect(value(session, `dark.${name}`, 'android')).toEqual([
                { kind: 'linear', locations: [0, 1], colors: ['#000000FF', '#FFFFFFFF'], angle: 45 },
            ]);
            expect(value(session, `light.${name}`, 'web')).toBe('#118833');
        }
    });

    it('своё значение iOS: копия построенного из web, не перестраивается при правке web, передаётся состояниям', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 0 });
        const { session, editor } = setup();

        editor.addPlatform(viewOf(session), 'light', 'ios');
        expect(isOverridden(session, 'light.text.default.accent', 'ios')).toBe(true);
        expect(isOverridden(session, 'light.text.default.accent-hover', 'ios')).toBe(true);
        editor.setPaint(viewOf(session), 'light', 'ios', { kind: 'color', color: '#445566' });
        editor.setField(viewOf(session), 'light', '#123456');

        expect(value(session, 'light.text.default.accent', 'ios')).toBe('#445566');
        expect(value(session, 'light.text.default.accent', 'android')).toBe('#123456');
        // Состояние своего значения считается от цвета платформы, а не от web.
        expect(value(session, 'light.text.default.accent-hover', 'ios')).not.toBe(
            value(session, 'light.text.default.accent-hover', 'web'),
        );

        await session.autosave.flush();
        const members = repository.updateValues.mock.calls[0][2].members;
        const item = (id: string, platform: string) =>
            members
                .find((member) => member.tokenId === id)
                ?.values.find((it) => it.platform === platform && it.mode === 'light');
        expect(item('id-0', 'ios')).toMatchObject({ value: ['#445566'], overridden: true });
        expect(item('id-0', 'android')).toMatchObject({ value: ['#123456'], overridden: false });
        expect(item('id-1', 'ios')).toMatchObject({ overridden: true });
        expect(item('id-0', 'web')).toMatchObject({ value: ['#123456'], overridden: false });

        editor.removePlatform(viewOf(session), 'light', 'ios');
        expect(value(session, 'light.text.default.accent', 'ios')).toBe('#123456');
        expect(isOverridden(session, 'light.text.default.accent', 'ios')).toBe(false);
    });

    it('без своей строки платформа каждого члена семейства строится из web того же члена', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 0 });
        // Web-значения состояний из сида отличаются от расчёта редактора по основному цвету.
        const seeded: Record<string, string> = {
            'text.default.accent-hover': '#0D731E',
            'text.default.accent-active': '#0B5F19',
        };
        const { session, editor } = setup(NAMES, (mode, name) => seeded[name] ?? VALUES[mode]);
        const states = Object.keys(seeded).map((name) => `light.${name}`);

        editor.addPlatform(viewOf(session), 'light', 'ios');
        expect(states.map((name) => value(session, name, 'web'))).toEqual(['#0D731E', '#0B5F19']);
        expect(value(session, 'light.text.default.accent-hover', 'android')).toBe('#0D731E');
        editor.removePlatform(viewOf(session), 'light', 'ios');

        for (const name of states) {
            expect(value(session, name, 'ios')).toBe(value(session, name, 'web'));
            expect(isOverridden(session, name, 'ios')).toBe(false);
        }
        expect(states.map((name) => value(session, name, 'web'))).toEqual(['#0D731E', '#0B5F19']);
        await session.autosave.flush();
        // Web состояний не менялся, а iOS вернулся к своему web: заново ничего из этого не отправляется.
        const sent = repository.updateValues.mock.calls.flatMap((call) =>
            call[2].members.filter((member) => member.tokenId !== 'id-0').flatMap((member) => member.values),
        );
        expect(sent.filter((item) => item.platform === 'web' || item.overridden)).toEqual([]);
    });

    it('у подтемы своя строка платформы не добавляется: строки только наследуются от режима', () => {
        const { session, editor } = setup();

        editor.addPlatform(viewOf(session), 'ondark-light', 'ios');

        expect(isOverridden(session, 'light.text.default.accent', 'ios')).toBe(false);
        expect(session.autosave.hasUnsaved()).toBe(false);
    });

    it('строка платформы связанной подтемы не убирается и в обход интерфейса', () => {
        // OnDark наследует Dark в обоих режимах: при тех же значениях подтема связана.
        const { session, editor } = setup([...NAMES, 'text.on-dark.accent'], (mode, name) =>
            name.includes('on-dark') ? VALUES.dark : VALUES[mode],
        );
        editor.addPlatform(viewOf(session), 'light', 'ios');
        editor.addPlatform(viewOf(session), 'dark', 'ios');
        const view = viewOf(session);
        expect(view.contexts.ondark.linked).toBe(true);
        const before = {
            light: isOverridden(session, 'light.text.on-dark.accent', 'ios'),
            dark: isOverridden(session, 'dark.text.on-dark.accent', 'ios'),
        };
        expect(before.light || before.dark).toBe(true);

        editor.removePlatform(view, 'ondark-light', 'ios');
        editor.removePlatform(view, 'ondark-dark', 'ios');

        expect(isOverridden(session, 'light.text.on-dark.accent', 'ios')).toBe(before.light);
        expect(isOverridden(session, 'dark.text.on-dark.accent', 'ios')).toBe(before.dark);
        expect(isOverridden(session, 'light.text.default.accent', 'ios')).toBe(true);
        expect(isOverridden(session, 'dark.text.default.accent', 'ios')).toBe(true);
    });

    it('тип из ответа переносит определения в список своего типа без смены ключа', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 0, type: 'gradient' });
        const { session, editor, theme } = setup();
        editor.setField(viewOf(session), 'dark', 'linear-gradient(45deg, #000000 0%, #FFFFFF 100%)');

        await session.autosave.flush();

        expect(theme.getToken('dark.text.default.accent', 'gradient')).toBeDefined();
        expect(theme.getToken('light.text.default.accent', 'gradient')?.getValue('web' as never)).toBe('#118833');
        expect(theme.getTokens('color')).toHaveLength(0);
        expect(session.definitions.get('text.default.accent')?.type).toBe('gradient');
        expect(viewOf(session).id).toBe('text.accent');
    });
});
