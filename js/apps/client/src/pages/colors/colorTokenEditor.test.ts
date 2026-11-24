import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/editorReads', () => ({ readEditor: vi.fn(), invalidateEditorReads: vi.fn() }));

const reads = vi.hoisted(() => ({ themes: vi.fn(), values: vi.fn(), invalidate: vi.fn() }));
vi.mock('../../modules/themes/data/themesApi', () => ({ themesApi: { list: reads.themes } }));
vi.mock('../../shared/data/useLoad', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../shared/data/useLoad')>()),
    invalidateQueryCache: reads.invalidate,
}));
vi.mock('../../api/tokenRepository', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/tokenRepository')>();
    return { ...actual, tokenRepository: { ...actual.tokenRepository, loadValuesByTenant: reads.values } };
});

import { AndroidColor, ColorToken, IOSColor, Theme, WebColor } from '../../controllers';
import {
    ColorTokenOperationError,
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
    isDetached,
    isOverridden,
    setColorTokenRepository,
    stateValue,
    type ColorTokenSession,
} from './colorTokenEditor';
import { acceptTokenValueDetached } from '../../api/subjectRevisions';

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
    addState: vi.fn<ColorTokenRepository['addState']>(),
    deleteState: vi.fn<ColorTokenRepository['deleteState']>(),
    describe: vi.fn<ColorTokenRepository['describe']>(),
};

type ValueOf = (mode: 'light' | 'dark', name: string) => string;

/** Тема с определениями [names] в обоих режимах. */
const themeOf = (names: string[], valueOf: ValueOf) =>
    new Theme('tenant', '1.0.0', {
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

/** Сессия темы с токеном `text.accent` и его состояниями `-hover` и `-active`. */
const setup = (names: string[] = NAMES, valueOf: ValueOf = (mode) => VALUES[mode]) => {
    setColorTokenRepository(repository, {} as TokenGroupRepository);
    const theme = themeOf(names, valueOf);
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
                detached: isDetached(session, item.getName()),
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

    it('правка iOS без своего значения делает его своим: не перестраивается при правке web, передаётся состояниям', async () => {
        repository.updateValues.mockResolvedValue({ editRevision: 0 });
        const { session, editor } = setup();

        expect(isOverridden(session, 'light.text.default.accent', 'ios')).toBe(false);
        editor.setPaint(viewOf(session), 'light', 'ios', { kind: 'color', color: '#445566' });
        expect(isOverridden(session, 'light.text.default.accent', 'ios')).toBe(true);
        expect(isOverridden(session, 'light.text.default.accent-hover', 'ios')).toBe(true);
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

        editor.setPaint(viewOf(session), 'light', 'ios', { kind: 'color', color: VALUES.light });
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

    it('правка подтемы на iOS записывает её своё значение и отвязывает подтему', () => {
        const { session, editor } = setup([...NAMES, 'text.on-dark.accent'], (mode, name) =>
            name.includes('on-dark') ? VALUES.dark : VALUES[mode],
        );
        expect(viewOf(session).contexts.ondark.linked).toBe(true);

        editor.setPaint(viewOf(session), 'ondark-light', 'ios', { kind: 'color', color: '#445566' });

        expect(value(session, 'light.text.on-dark.accent', 'ios')).toBe('#445566');
        expect(isOverridden(session, 'light.text.default.accent', 'ios')).toBe(false);
        expect(session.detachments.get('light.text.on-dark.accent')).toBe(true);
    });

    it('строка платформы связанной подтемы не убирается и в обход интерфейса', () => {
        // OnDark без признака `detached` связана с Dark и получает его значения платформ.
        const { session, editor } = setup([...NAMES, 'text.on-dark.accent'], (mode, name) =>
            name.includes('on-dark') ? VALUES.dark : VALUES[mode],
        );
        editor.setPaint(viewOf(session), 'light', 'ios', { kind: 'color', color: '#445566' });
        editor.setPaint(viewOf(session), 'dark', 'ios', { kind: 'color', color: '#556677' });
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

const stateOf = (session: ColorTokenSession, state: 'hover' | 'active' | 'brightness') =>
    viewOf(session).states!.find((item) => item.state === state)!;

/** Значения токена `id-0` другой темы: хранимая ссылка [ref] и её цвет [color] в палитре той темы. */
const otherValues = (ref: string, color: string) =>
    (['light', 'dark'] as const).flatMap((mode) =>
        (['web', 'ios', 'android'] as const).map((platform) => ({
            id: `${platform}-${mode}`,
            tokenId: 'id-0',
            tenantId: 't-other',
            platform,
            mode,
            paletteRef: ref,
            value: [color],
            editRevision: 1,
        })),
    );

const addedFamily = (type: 'color' | 'gradient') => ({
    editRevision: 0,
    value: {
        type,
        group: 'text',
        name: 'accent',
        members: [
            { tokenId: 'id-0', name: 'text.default.accent' },
            { tokenId: 'id-hover', name: 'text.default.accent-hover' },
        ],
    },
});

describe('редактор цветовых токенов: состояния', () => {
    it('выключенная формула оставляет значения и не пересчитывает состояние при правке токена', () => {
        const { session, editor } = setup();
        const hover = value(session, 'light.text.default.accent-hover', 'web');
        const active = value(session, 'light.text.default.accent-active', 'web');

        editor.setStateFormula(stateOf(session, 'hover'), false);
        expect(stateOf(session, 'hover').formula).toBe(false);
        editor.setField(viewOf(session), 'light', '#3355AA');

        expect(value(session, 'light.text.default.accent-hover', 'web')).toBe(hover);
        expect(value(session, 'light.text.default.accent-active', 'web')).not.toBe(active);
        expect(session.detachments.get('light.text.default.accent-hover')).toBe(true);
        expect(session.detachments.get('dark.text.default.accent-hover')).toBe(true);
    });

    it('состояние по формуле не правится, ручное правится, включение формулы пересчитывает значения', () => {
        const { session, editor } = setup();
        const formula = value(session, 'light.text.default.accent-hover', 'web');
        editor.setField(stateOf(session, 'hover'), 'light', '#000000');
        expect(value(session, 'light.text.default.accent-hover', 'web')).toBe(formula);

        editor.setStateFormula(stateOf(session, 'hover'), false);
        editor.setField(stateOf(session, 'hover'), 'light', '#000000');
        expect(value(session, 'light.text.default.accent-hover', 'web')).toBe('#000000');

        editor.setField(viewOf(session), 'light', '#3355AA');
        editor.setStateFormula(stateOf(session, 'hover'), true);
        const recomputed = value(session, 'light.text.default.accent-hover', 'web');
        expect(recomputed).not.toBe('#000000');
        expect(recomputed).not.toBe('#3355AA');
        expect(stateOf(session, 'hover').formula).toBe(true);
        expect(session.detachments.get('light.text.default.accent-hover')).toBe(false);
    });

    it('ручная правка Dark состояния переходит в связанную подтему состояния, правка подтемы её отвязывает', () => {
        const names = [...NAMES, 'text.on-dark.accent', 'text.on-dark.accent-hover'];
        const { session, editor } = setup(names, (mode) => VALUES[mode]);
        editor.setStateFormula(stateOf(session, 'hover'), false);

        editor.setField(stateOf(session, 'hover'), 'dark', '#101010');
        expect(value(session, 'light.text.on-dark.accent-hover', 'web')).toBe('#101010');
        expect(value(session, 'dark.text.on-dark.accent-hover', 'web')).toBe('#101010');

        editor.setField(stateOf(session, 'hover'), 'ondark-light', '#202020');
        expect(session.detachments.get('light.text.on-dark.accent-hover')).toBe(true);
        expect(stateOf(session, 'hover').contexts.ondark.linked).toBe(false);
        expect(value(session, 'light.text.on-dark.accent', 'web')).toBe(VALUES.light);
    });

    it('Brightness считается своей формулой при правке токена, пока формулу не выключили', () => {
        const { session, editor } = setup([...NAMES, 'text.default.accent-brightness']);
        expect(stateOf(session, 'brightness')).toMatchObject({ formulaAvailable: true, formula: true });

        editor.setField(viewOf(session), 'light', '#3355AA');
        const brightness = value(session, 'light.text.default.accent-brightness', 'web');
        expect([VALUES.light, '#3355AA', value(session, 'light.text.default.accent-hover', 'web')]).not.toContain(
            brightness,
        );

        editor.setStateFormula(stateOf(session, 'brightness'), false);
        editor.setField(viewOf(session), 'light', '#225599');
        expect(value(session, 'light.text.default.accent-brightness', 'web')).toBe(brightness);
    });

    it('у группы без формулы состояние задаётся вручную, переключатель ничего не меняет', () => {
        const names = ['background.default.primary', 'background.default.primary-hover'];
        const { session, editor } = setup(names);
        const hover = stateOf(session, 'hover');
        expect(hover).toMatchObject({ formulaAvailable: false, formula: false });

        editor.setStateFormula(hover, true);
        expect(session.detachments.size).toBe(0);
        editor.setField(hover, 'light', '#ABCDEF');
        expect(value(session, 'light.background.default.primary-hover', 'web')).toBe('#ABCDEF');
    });

    it('добавление считает значения каждой темы от её токена и повторяется после смены списка тем', async () => {
        const { session, editor, theme } = setup(['text.default.accent']);
        reads.themes.mockResolvedValue([{ id: session.context.tenantId }, { id: 't-other' }]);
        reads.values.mockResolvedValue(
            new Map([
                [
                    't-other',
                    (['light', 'dark'] as const).flatMap((mode) =>
                        (['web', 'ios', 'android'] as const).map((platform) => ({
                            id: `${platform}-${mode}`,
                            tokenId: 'id-0',
                            tenantId: 't-other',
                            platform,
                            mode,
                            value: ['#336699'],
                            editRevision: 1,
                        })),
                    ),
                ],
            ]),
        );
        repository.addState
            .mockRejectedValueOnce(new ColorTokenOperationError('invalid', 'Темы', 'INVALID_TOKEN_FAMILY'))
            .mockResolvedValueOnce({
                editRevision: 0,
                value: {
                    type: 'color',
                    group: 'text',
                    name: 'accent',
                    members: [
                        { tokenId: 'id-0', name: 'text.default.accent' },
                        { tokenId: 'id-hover', name: 'text.default.accent-hover' },
                    ],
                },
            });

        await editor.addState(viewOf(session), 'hover');

        expect(reads.themes).toHaveBeenCalledTimes(2);
        // Перед повтором список тем читается мимо кеша.
        expect(reads.invalidate).toHaveBeenCalledWith('themes:p:ds');
        expect(reads.invalidate.mock.invocationCallOrder[0]).toBeLessThan(reads.themes.mock.invocationCallOrder[1]);
        const tenants = repository.addState.mock.calls[1][3];
        expect(tenants.map((item) => item.tenantId)).toEqual([session.context.tenantId, 't-other']);
        const web = (tenantId: string) =>
            tenants
                .find((item) => item.tenantId === tenantId)!
                .members[0].values.find((item) => item.platform === 'web' && item.mode === 'light');
        expect(tenants[0].members[0].name).toBe('text.default.accent-hover');
        expect(web(session.context.tenantId)?.value).not.toEqual(web('t-other')?.value);
        expect(web('t-other')?.value).not.toEqual(['#336699']);
        expect(web('t-other')?.detached).toBe(false);
        expect(theme.getToken('light.text.default.accent-hover', 'color')?.getValue('web' as never)).toEqual(
            (web(session.context.tenantId)?.value as string[])[0],
        );
        expect(session.definitions.get('text.default.accent-hover')?.id).toBe('id-hover');
        expect(viewOf(session).states?.map((item) => item.state)).toEqual(['hover']);
    });

    it('формула другой темы считается от её цвета палитры, ссылка без формулы копируется', async () => {
        const { session, editor } = setup(['text.default.accent']);
        reads.themes.mockResolvedValue([{ id: session.context.tenantId }, { id: 't-other' }]);
        reads.values.mockResolvedValue(new Map([['t-other', otherValues('[general.red.500]', '#F50029')]]));
        repository.addState.mockResolvedValue(addedFamily('color'));

        await editor.addState(viewOf(session), 'hover');

        const other = repository.addState.mock.calls[0][3].find((item) => item.tenantId === 't-other')!;
        const web = other.members[0].values.find((item) => item.platform === 'web' && item.mode === 'light');
        expect(web?.value).toEqual([stateValue('#F50029', 'text', 'default', 'light', 'hover')]);
    });

    it('добавленное состояние наследует доступность токена, градиент платформ остаётся массивом слоёв', async () => {
        const { session, editor, theme } = setup(['text.default.accent']);
        session.theme!.getTokens('color').forEach((token) => token.setEnabled(false));
        const paint = readPaint(['linear-gradient(45deg, #000000 0%, #FFFFFF 100%)'], 'web') as Paint;
        editor.setPaint(viewOf(session), 'dark', 'web', paint);
        reads.themes.mockResolvedValue([{ id: session.context.tenantId }]);
        reads.values.mockResolvedValue(new Map());
        repository.addState.mockResolvedValue(addedFamily('gradient'));

        await editor.addState(viewOf(session), 'hover');

        const hover = theme.getToken('dark.text.default.accent-hover', 'gradient');
        expect(hover?.getEnabled()).toBe(false);
        expect(readPaint(hover?.getValue('ios' as never), 'ios')?.kind).toBe('gradient');
    });

    it('ручной признак одной платформы выключает формулу: правка токена не меняет состояние', () => {
        const { session, editor } = setup();
        acceptTokenValueDetached(session.context, 'id-1', 'ios', 'dark', true);
        const hover = value(session, 'dark.text.default.accent-hover', 'ios');

        expect(stateOf(session, 'hover').formula).toBe(false);
        editor.setField(viewOf(session), 'dark', '#3355AA');
        expect(value(session, 'dark.text.default.accent-hover', 'ios')).toBe(hover);
    });

    it('перезагрузка темы не возвращает старое значение ручного состояния, которое правка токена не меняла', () => {
        const { session, editor } = setup();
        for (const mode of ['light', 'dark']) acceptTokenValueDetached(session.context, 'id-1', 'web', mode, true);
        editor.setField(viewOf(session), 'light', '#3355AA');
        const active = value(session, 'light.text.default.accent-active', 'web');

        const reloaded = themeOf(NAMES, (_mode, name) => (name.endsWith('-hover') ? '#FF0000' : '#000000'));
        adoptTheme(session, reloaded);

        expect(value(session, 'light.text.default.accent-hover', 'web')).toBe('#FF0000');
        expect(value(session, 'light.text.default.accent', 'web')).toBe('#3355AA');
        expect(value(session, 'light.text.default.accent-active', 'web')).toBe(active);
    });

    it('«Заполнить» у ручного Brightness заполняет его пустые значения', () => {
        const names = ['text.default.accent', 'text.default.accent-brightness'];
        const { session, editor } = setup(names, (mode, name) =>
            name.endsWith('-brightness') && mode === 'light' ? '' : VALUES[mode],
        );
        editor.setStateFormula(stateOf(session, 'brightness'), false);

        editor.fill(stateOf(session, 'brightness'), { light: '#ABCDEF', dark: '#123456' });

        expect(value(session, 'light.text.default.accent-brightness', 'web')).toBe('#ABCDEF');
        expect(value(session, 'dark.text.default.accent-brightness', 'web')).toBe(VALUES.dark);
    });

    it('удаление состояния с единственным градиентом возвращает токену тип color', async () => {
        const { session, editor, theme } = setup(['text.default.accent', 'text.default.accent-hover']);
        session.definitions.forEach((definition) => (definition.type = 'gradient'));
        repository.deleteState.mockResolvedValue({
            editRevision: 0,
            structure: {
                definitions: [
                    {
                        id: 'id-0',
                        designSystemId: 'ds',
                        name: 'text.default.accent',
                        type: 'color',
                        displayName: null,
                        description: null,
                        enabled: true,
                        groupId: null,
                        position: 0,
                    },
                ],
                removedTokenIds: ['id-1'],
                placements: [],
            },
        } as never);

        await editor.removeState(stateOf(session, 'hover'));

        expect(session.definitions.get('text.default.accent')?.type).toBe('color');
        expect(theme.getToken('light.text.default.accent', 'color')).toBeDefined();
    });

    it('удаление состояния убирает его определения, токен и другие состояния остаются', async () => {
        repository.deleteState.mockResolvedValue({ editRevision: 0 });
        const { session, editor, theme } = setup();

        await editor.removeState(stateOf(session, 'hover'));

        expect(repository.deleteState.mock.calls[0].slice(1, 3)).toEqual(['id-0', 'hover']);
        expect(theme.getToken('light.text.default.accent-hover', 'color')).toBeUndefined();
        expect(theme.getToken('light.text.default.accent-active', 'color')).toBeDefined();
        expect(session.definitions.has('text.default.accent-hover')).toBe(false);
        expect(viewOf(session).states?.map((item) => item.state)).toEqual(['active']);
    });
});
