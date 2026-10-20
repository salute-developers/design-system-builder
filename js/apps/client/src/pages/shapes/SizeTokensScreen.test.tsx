import { useReducer } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../api/index', () => ({ http: { get, put: vi.fn() }, PROJECTS_URL: '/api/projects' }));

import { ThemeEditorRepository } from '../../api/themeEditorRepository';
import { DesignSystem } from '../../controllers';
import {
    SizeTokenOperationError,
    themeValuesFromToken,
    toRem,
    type DimensionToken,
    type ShadowLayer,
    type ShadowToken,
    type SizeToken,
    type SizeTokenRepository,
    type SizeTokens,
    type SizeTokenValue,
} from '../../modules/sizeTokens';
import { applyDraftChanges, setActiveDraftContext } from '../../utils/designSystemDraft';
import { setSizeTokenRepository } from './sizeTokenEditor';
import { SizeTokensScreen } from './SizeTokensScreen';

const dimension = (
    kind: 'radius' | 'spacing',
    name: string,
    valuePx: number | null,
    extra: Partial<DimensionToken> = {},
): DimensionToken => ({
    kind,
    tokenId: `id-${name}`,
    name,
    valuePx,
    fullRounding: name === 'round.circle',
    platforms: {},
    native: { ios: valuePx, android: valuePx },
    platformsDiffer: false,
    components: [],
    derived: [],
    ...extra,
});

const layer = (offsetY: number, blur: number, color = '#00000014'): ShadowLayer => ({
    offsetX: 0,
    offsetY,
    blur,
    spread: -4,
    color,
});

const shadow = (name: string, layers: ShadowLayer[], extra: Partial<ShadowToken> = {}): ShadowToken => ({
    kind: 'shadow',
    tokenId: `id-${name}`,
    name,
    layers,
    fallbackElevation: 4,
    platforms: {},
    native: { ios: { layers }, android: { layers } },
    platformsDiffer: false,
    components: [],
    ...extra,
});

const fixture = (): SizeToken[] => [
    dimension('radius', 'round.m', 12, {
        components: [
            { name: 'Slider', count: 2 },
            { name: 'EmptyState', count: 3 },
        ],
    }),
    dimension('radius', 'round.l', 16, {
        derived: [
            {
                offsetPx: -2,
                valuePx: 14,
                usages: [
                    { component: 'Button', platform: 'web', parameter: 'buttonRadius' },
                    { component: 'IconButton', platform: 'web', parameter: 'iconButtonRadius' },
                ],
            },
        ],
    }),
    dimension('radius', 'round.xxl', 32, { native: { ios: 40, android: 40 }, platformsDiffer: true }),
    dimension('radius', 'round.circle', null),
    dimension('spacing', 'spacing.4x', 8),
    dimension('spacing', 'spacing.2x', 4),
    shadow('down.soft.s', [layer(4, 14), layer(1, 4)], { fallbackElevation: 2 }),
    shadow('down.soft.m', [layer(8, 24)]),
    shadow('down.hard.m', [layer(6, 12, '#00000029')], { components: [{ name: 'Popover', count: 1 }] }),
    shadow('up.soft.m', [layer(-8, 24)], { fallbackElevation: 0 }),
    shadow('up.hard.m', [layer(-6, 12)], { fallbackElevation: 0 }),
];

const THEME_TYPE = { radius: 'shape', spacing: 'spacing', shadow: 'shadow' } as const;

const reply = (tokens: SizeToken[], role: string) => (url: string) => {
    if (url.endsWith('/projects/project-1')) return { data: { name: 'Platform', effectiveRole: role } };
    if (url.endsWith('/design-systems/ds-1')) return { data: { id: 'ds-1', name: 'System' } };
    if (url.endsWith('/tenants/tenant-1'))
        return { data: { id: 'tenant-1', designSystemId: 'ds-1', name: 'base_default', editRevision: 3 } };
    if (url.endsWith('/design-systems/ds-1/tokens'))
        return {
            data: tokens.map((token) => ({
                id: token.tokenId,
                designSystemId: 'ds-1',
                name: token.name,
                type: THEME_TYPE[token.kind],
                displayName: null,
                description: null,
                enabled: true,
            })),
        };
    if (url.endsWith('/tenants/tenant-1/token-values'))
        return {
            data: tokens.flatMap((token) => {
                const values = themeValuesFromToken(token) ?? {
                    web: '625rem',
                    ios: { kind: 'round', cornerRadius: 9999 },
                    android: { kind: 'round', cornerRadius: 9999 },
                };
                return (['web', 'ios', 'android'] as const).map((platform) => ({
                    tokenId: token.tokenId,
                    tenantId: 'tenant-1',
                    platform,
                    mode: null,
                    value: ([] as unknown[]).concat(values[platform]),
                }));
            }),
        };
    if (url.endsWith('/component-configs')) return { data: [] };
    throw new Error(`Unexpected URL ${url}`);
};

/** Ответ изменения: токен в формате чтения с новым значением и записанные значения платформ. */
const applyValue = (token: SizeToken, value: SizeTokenValue): SizeToken => {
    if (token.kind === 'shadow' && value.kind === 'shadow') {
        const own = (platform: 'ios' | 'android') => value.platforms[platform];
        return {
            ...token,
            layers: value.layers,
            fallbackElevation: value.fallbackElevation,
            platforms: Object.fromEntries(
                (['ios', 'android'] as const).flatMap((platform) =>
                    own(platform) ? [[platform, { layers: own(platform)! }]] : [],
                ),
            ),
            native: {
                ios: { layers: own('ios') ?? value.layers },
                android: { layers: own('android') ?? value.layers },
            },
            platformsDiffer: false,
        };
    }
    if (token.kind !== 'shadow' && value.kind === 'dimension')
        return {
            ...token,
            valuePx: value.valuePx,
            platforms: value.platforms,
            native: {
                ios: value.platforms.ios ?? value.valuePx,
                android: value.platforms.android ?? value.valuePx,
            },
            platformsDiffer: false,
            derived: token.derived.map((item) => ({ ...item, valuePx: Math.max(0, value.valuePx + item.offsetPx) })),
        };
    return token;
};

let state: SizeTokens;
const repository = {
    load: vi.fn<SizeTokenRepository['load']>(),
    updateValue: vi.fn<SizeTokenRepository['updateValue']>(),
    create: vi.fn<SizeTokenRepository['create']>(),
    delete: vi.fn<SizeTokenRepository['delete']>(),
};

const resetRepository = () => {
    state = { editRevision: 3, canEdit: true, tokens: fixture() };
    repository.load.mockReset().mockImplementation(async () => structuredClone(state));
    repository.updateValue.mockReset().mockImplementation(async (_c, tokenId, value, editRevision) => {
        const token = applyValue(state.tokens.find((item) => item.tokenId === tokenId)!, value);
        state = {
            ...state,
            editRevision: editRevision + 1,
            tokens: state.tokens.map((item) => (item.tokenId === tokenId ? token : item)),
        };
        const values = themeValuesFromToken(token)!;
        return {
            editRevision: editRevision + 1,
            token,
            values: (['web', 'ios', 'android'] as const).map((platform) => ({
                platform,
                value: ([] as unknown[]).concat(values[platform]),
                overridden: platform !== 'web' && token.platforms[platform] !== undefined,
            })),
        };
    });
    repository.create.mockReset();
    repository.delete.mockReset();
    setSizeTokenRepository(repository);
};

let tenantSeq = 0;

const renderScreen = async ({ role = 'maintainer' } = {}) => {
    get.mockImplementation((url: string) => Promise.resolve(reply(state.tokens, role)(url)));
    const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
    const snapshot = await new ThemeEditorRepository().load(context);
    const designSystem = DesignSystem.fromSnapshot({
        name: snapshot.designSystem.name,
        parameters: snapshot.parameters,
        themeData: snapshot.themeData,
        componentsData: snapshot.componentsData,
    });
    const theme = designSystem.createThemeInstance({ includeExtraTokens: true });
    // Отдельная тема на каждый тест: сессии автосохранения хранятся по контексту темы.
    const screenContext = { ...context, tenantId: `tenant-${++tenantSeq}` };
    setActiveDraftContext(screenContext);
    const reload = vi.fn();
    const Host = () => {
        const [, rerender] = useReducer((value: number) => value + 1, 0);
        return (
            <SizeTokensScreen
                context={screenContext}
                designSystem={designSystem}
                theme={theme}
                rerender={rerender}
                reload={reload}
            />
        );
    };
    render(
        <MemoryRouter>
            <Host />
        </MemoryRouter>,
    );
    await screen.findByTestId('size-tokens-screen');
    return { designSystem, theme, reload, context: screenContext };
};

const inspector = () => document.querySelector('.properties-panel') as HTMLElement;
const tree = () => document.querySelector('.token-browser') as HTMLElement;
const board = () => document.querySelector('.preview-canvas') as HTMLElement;
const row = (name: string) => tree().querySelector(`[data-token-name="${name}"]`) as HTMLElement;
const commit = (field: HTMLElement, value: string) => {
    fireEvent.change(field, { target: { value } });
    fireEvent.blur(field);
};
const valueField = () => within(inspector()).getByRole('textbox', { name: 'Значение, px' });
const saveStatus = () => screen.getByTestId('size-tokens-save-status');

beforeEach(() => {
    localStorage.clear();
    resetRepository();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setActiveDraftContext(null);
});

describe('SizeTokensScreen', () => {
    it('показывает дерево разделов, борд радиусов и инспектор round.m по умолчанию', async () => {
        await renderScreen();
        const headings = within(tree()).getAllByRole('button', { expanded: true });
        expect(headings.map((item) => item.lastChild?.textContent)).toEqual(['Радиусы', 'Отступы', 'Тени']);
        expect(row('round.m')).toHaveTextContent('M12 px');
        expect(row('round.circle')).toHaveTextContent('CircleFull');
        expect(row('spacing.4x')).toHaveTextContent('4x8 px');
        expect(row('down.soft.s')).toHaveTextContent('Down Soft SY 4 · B 14 · 2 сл.');
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Радиусы / M');
        expect(valueField()).toHaveValue('12');
        expect(row('round.m')).toHaveClass('is-selected');
        // Радиусы по значению, полное скругление последним.
        const radii = [...screen.getByTestId('size-section-radius').querySelectorAll('[data-token-name]')].map((item) =>
            item.getAttribute('data-token-name'),
        );
        expect(radii).toEqual(['round.m', 'round.l', 'round.xxl', 'round.circle']);
        expect(within(inspector()).getByTestId('size-token-impact')).toHaveTextContent('Компоненты 2');
        expect(inspector()).toHaveTextContent('СПИСОК КОМПОНЕНТОВ · 5 ЭКЗЕМПЛЯРОВ');
    });

    it('ищет токены по имени и сворачивает раздел', async () => {
        await renderScreen();
        fireEvent.click(within(tree()).getByRole('button', { name: 'Поиск' }));
        fireEvent.change(within(tree()).getByRole('textbox', { name: 'Найти токен' }), { target: { value: 'HARD' } });
        expect(tree().querySelectorAll('[data-token-name]')).toHaveLength(2);
        expect(row('down.hard.m')).toBeInTheDocument();
        fireEvent.change(within(tree()).getByRole('textbox', { name: 'Найти токен' }), { target: { value: '' } });
        fireEvent.click(within(tree()).getByRole('button', { name: 'Отступы' }));
        expect(row('spacing.4x')).toBeNull();
        expect(within(tree()).getByRole('button', { name: 'Отступы' })).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(within(tree()).getByRole('button', { name: 'Отступы' }));
        expect(row('spacing.4x')).toBeInTheDocument();
    });

    it('сохраняет правку значения одной операцией и обновляет модель темы и ревизию', async () => {
        const { designSystem, theme } = await renderScreen();
        commit(valueField(), '13');
        commit(valueField(), '14');
        expect(saveStatus()).toHaveTextContent('Сохранение…');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));
        expect(repository.updateValue).toHaveBeenCalledTimes(1);
        expect(repository.updateValue.mock.calls[0].slice(1)).toEqual([
            'id-round.m',
            { kind: 'dimension', valuePx: 14, platforms: {} },
            3,
        ]);
        expect(designSystem.getParameters()?.editRevision).toBe(4);
        expect(theme.getTokenValue('round.m', 'shape', 'web')).toBe(toRem(14));
        expect(row('round.m')).toHaveTextContent('14 px');
    });

    it('добавляет и убирает своё значение платформы', async () => {
        await renderScreen();
        fireEvent.click(row('round.l'));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Своё значение платформы' }));
        fireEvent.click(within(inspector()).getByRole('menuitem', { name: 'Android' }));
        const android = within(inspector()).getByRole('textbox', { name: 'Значение Android, px' });
        expect(android).toHaveValue('16');
        expect(screen.getByTestId('override-android')).toHaveTextContent('↳ Android');
        commit(android, '18');
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(1));
        expect(repository.updateValue.mock.calls[0][2]).toEqual({
            kind: 'dimension',
            valuePx: 16,
            platforms: { android: 18 },
        });
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));

        // Правка веба оставляет своё значение Android.
        commit(valueField(), '20');
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(2));
        expect(repository.updateValue.mock.calls[1][2]).toEqual({
            kind: 'dimension',
            valuePx: 20,
            platforms: { android: 18 },
        });
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));

        fireEvent.click(within(inspector()).getByRole('button', { name: 'Своё значение платформы' }));
        fireEvent.click(within(inspector()).getByRole('menuitem', { name: 'iOS' }));
        expect(within(inspector()).getByRole('button', { name: 'Своё значение платформы' })).toBeDisabled();

        fireEvent.click(within(inspector()).getByRole('button', { name: 'Убрать своё значение Android' }));
        expect(screen.queryByTestId('override-android')).toBeNull();
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(3));
        expect(repository.updateValue.mock.calls[2][2]).toEqual({
            kind: 'dimension',
            valuePx: 20,
            platforms: { ios: 20 },
        });
    });

    it('предупреждает о расхождении платформ и сохраняет их как свои значения', async () => {
        await renderScreen();
        fireEvent.click(row('round.xxl'));
        expect(screen.getByTestId('platforms-differ')).toHaveTextContent(
            'Сейчас iOS 40 px, Android 40 px, на вебе 32 px. Значения платформ строятся из веба: правка выровняет их.',
        );
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Оставить как свои значения iOS и Android' }));
        expect(screen.getByTestId('override-ios')).toBeInTheDocument();
        expect(screen.getByTestId('override-android')).toBeInTheDocument();
        expect(screen.queryByTestId('platforms-differ')).toBeNull();
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(1));
        expect(repository.updateValue.mock.calls[0][2]).toEqual({
            kind: 'dimension',
            valuePx: 32,
            platforms: { ios: 40, android: 40 },
        });
    });

    it('показывает вычисляемые радиусы на борде и в инспекторе и пересчитывает их', async () => {
        await renderScreen();
        const derived = screen.getByTestId('derived-radii');
        expect(derived).toHaveTextContent('L − 2');
        expect(derived).toHaveTextContent('14 px · Button, IconButton');
        fireEvent.click(within(derived).getByRole('button', { name: /L − 2/ }));
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Радиусы / L');
        const section = screen.getByTestId('derived-section');
        expect(section).toHaveTextContent('Button · Web · buttonRadius; IconButton · Web · iconButtonRadius');
        expect(section).toHaveTextContent('Смещение задаётся в компоненте.');
        commit(valueField(), '20');
        expect(screen.getByTestId('derived-section')).toHaveTextContent('18 px');
        expect(screen.getByTestId('derived-radii')).toHaveTextContent('18 px · Button, IconButton');
    });

    it('не показывает группу «Вычисляемые» без смещений', async () => {
        state = {
            ...state,
            tokens: state.tokens.map((token) => (token.kind === 'radius' ? { ...token, derived: [] } : token)),
        };
        await renderScreen();
        expect(screen.queryByTestId('derived-radii')).toBeNull();
    });

    it('показывает полное скругление недоступным', async () => {
        await renderScreen();
        fireEvent.click(row('round.circle'));
        expect(valueField()).toHaveValue('Full');
        expect(valueField()).toBeDisabled();
        expect(inspector()).toHaveTextContent('Полное скругление');
        expect(within(inspector()).queryByRole('button', { name: 'Своё значение платформы' })).toBeNull();
    });

    it('показывает ошибку значения у поля и оставляет сохранённое значение в дереве', async () => {
        await renderScreen();
        commit(valueField(), '1200');
        expect(inspector()).toHaveTextContent('Значение должно быть в диапазоне 0–1000 px.');
        expect(valueField()).toHaveValue('1200');
        commit(valueField(), '12.5');
        expect(inspector()).toHaveTextContent('Размер должен быть целым числом.');
        await act(() => new Promise((done) => setTimeout(done, 450)));
        expect(repository.updateValue).not.toHaveBeenCalled();

        repository.updateValue.mockRejectedValueOnce(
            new SizeTokenOperationError(
                'invalid',
                'Значение должно быть в диапазоне 0–1000 px.',
                'INVALID_SIZE_VALUE',
                'valuePx',
            ),
        );
        commit(valueField(), '999');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Не сохранено'));
        expect(inspector().querySelector('.st-field-error')).toHaveTextContent(
            'Значение должно быть в диапазоне 0–1000 px.',
        );
        expect(valueField()).toHaveValue('999');
        expect(row('round.m')).toHaveTextContent('12 px');
    });

    it('при ошибке сети оставляет ввод и повторяет отправку', async () => {
        await renderScreen();
        repository.updateValue.mockRejectedValueOnce(new SizeTokenOperationError('network', 'Сервис недоступен'));
        commit(valueField(), '15');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Не сохранено'));
        expect(inspector()).toHaveTextContent('Не сохранено: Сервис недоступен');
        expect(valueField()).toHaveValue('15');
        fireEvent.click(within(saveStatus()).getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));
        expect(repository.updateValue).toHaveBeenCalledTimes(2);
    });

    it('после конфликта перечитывает раздел и отправляет правку только по «Повторить»', async () => {
        await renderScreen();
        repository.updateValue.mockRejectedValueOnce(
            new SizeTokenOperationError('conflict', 'Тема изменена', 'TENANT_EDIT_CONFLICT', null, 9),
        );
        state = { ...state, editRevision: 9 };
        commit(valueField(), '15');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Тема изменена в другом месте'));
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
        expect(inspector()).toHaveTextContent('Тема изменена в другом месте и перезагружена.');
        expect(valueField()).toHaveValue('15');
        await act(() => new Promise((done) => setTimeout(done, 450)));
        expect(repository.updateValue).toHaveBeenCalledTimes(1);
        fireEvent.click(within(saveStatus()).getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));
        expect(repository.updateValue.mock.calls[1][3]).toBe(9);
    });

    it('правит слой тени, цвет и свои слои iOS', async () => {
        await renderScreen();
        fireEvent.click(row('down.hard.m'));
        expect(within(board()).getByTestId('shadow-grid').querySelectorAll('.st-shadow-card')).toHaveLength(5);
        expect(within(board()).getByRole('button', { name: 'down.hard.m' })).toHaveClass('is-selected');
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Тени / Down Hard M');
        // Один слой: удалить его нельзя.
        expect(within(inspector()).queryByRole('button', { name: 'Удалить слой 1' })).toBeNull();

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, Y' }), '10');
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(1));
        expect(repository.updateValue.mock.calls[0][2]).toEqual({
            kind: 'shadow',
            layers: [{ ...layer(6, 12, '#00000029'), offsetY: 10 }],
            fallbackElevation: 4,
            platforms: {},
        });

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, HEX' }), '#000000');
        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, прозрачность' }), '24%');
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(2));
        expect((repository.updateValue.mock.calls[1][2] as { layers: ShadowLayer[] }).layers[0].color).toBe(
            '#0000003D',
        );

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, Blur' }), '-1');
        expect(inspector()).toHaveTextContent('Blur: Значение должно быть в диапазоне 0–200 px.');

        fireEvent.click(within(inspector()).getByRole('button', { name: 'Свои слои платформы' }));
        fireEvent.click(within(inspector()).getByRole('menuitem', { name: 'iOS' }));
        const own = screen.getByTestId('override-layers-ios');
        expect(own).toHaveTextContent('↳ iOS · СВОИ СЛОИ');
        commit(within(own).getByRole('textbox', { name: 'iOS, слой 1, X' }), '3');
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(3));
        const sent = repository.updateValue.mock.calls[2][2] as Extract<SizeTokenValue, { kind: 'shadow' }>;
        expect(sent.platforms.ios?.[0].offsetX).toBe(3);
        expect(sent.layers[0].offsetX).toBe(0);

        fireEvent.click(within(inspector()).getAllByRole('button', { name: '+ Добавить слой' })[0]);
        expect(within(inspector()).getAllByRole('button', { name: 'Удалить слой 2' })).toHaveLength(1);
        commit(within(inspector()).getByRole('textbox', { name: 'Запасная высота Android' }), '6');
        await waitFor(() => expect(repository.updateValue).toHaveBeenCalledTimes(4));
        const last = repository.updateValue.mock.calls[3][2] as Extract<SizeTokenValue, { kind: 'shadow' }>;
        expect(last.layers).toHaveLength(2);
        expect(last.fallbackElevation).toBe(6);
    });

    it('создаёт радиус, отступ и размер тени в окне «Новый токен»', async () => {
        await renderScreen();
        repository.create.mockImplementation(async (_c, request, editRevision) => {
            const created =
                request.kind === 'shadow'
                    ? request.variants.map((variant) => shadow(`${variant.variant}.${request.name}`, variant.layers))
                    : [
                          dimension(
                              request.kind,
                              `${request.kind === 'radius' ? 'round' : 'spacing'}.${request.name}`,
                              request.valuePx,
                          ),
                      ];
            state = { ...state, tokens: [...state.tokens, ...created] };
            return { editRevision: editRevision + 1, created };
        });

        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Радиусы' }));
        let dialog = screen.getByRole('dialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Создать токен' }));
        expect(dialog).toHaveTextContent('Введите имя токена: латиница и цифры.');
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Имя токена' }), { target: { value: 'M' } });
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Значение, px' }), { target: { value: '40' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Создать токен' }));
        expect(dialog).toHaveTextContent('Токен round.m уже есть в теме.');
        expect(repository.create).not.toHaveBeenCalled();
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Имя токена' }), { target: { value: 'XXXL' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Создать токен' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(repository.create.mock.calls[0][1]).toEqual({ kind: 'radius', name: 'xxxl', valuePx: 40 });
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Радиусы / XXXL');
        expect(row('round.xxxl')).toHaveClass('is-selected');

        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Отступы' }));
        dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Значение, px' }), { target: { value: '28' } });
        expect(within(dialog).getByRole('textbox', { name: 'Имя токена' })).toHaveValue('14x');
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Значение, px' }), { target: { value: '27' } });
        expect(within(dialog).getByRole('textbox', { name: 'Имя токена' })).toHaveValue('');
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Значение, px' }), { target: { value: '28' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Создать токен' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(repository.create.mock.calls[1][1]).toEqual({ kind: 'spacing', name: '14x', valuePx: 28 });

        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Тени' }));
        dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Размер' }), { target: { value: 'xl' } });
        expect(screen.getByTestId('new-shadow-names')).toHaveTextContent(
            'down.soft.xldown.hard.xlup.soft.xlup.hard.xl',
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Создать токен' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        const request = repository.create.mock.calls[2][1];
        expect(request).toMatchObject({ kind: 'shadow', name: 'xl' });
        if (request.kind !== 'shadow') throw new Error('ожидалась тень');
        expect(request.variants[2]).toEqual({ variant: 'up.soft', layers: [layer(-8, 24)], fallbackElevation: 0 });
        expect(row('down.soft.xl')).toHaveClass('is-selected');
    });

    it('оставляет окно открытым с текстом отказа сервера', async () => {
        await renderScreen();
        let finish: (error: Error) => void = () => undefined;
        repository.create.mockImplementation(() => new Promise((_, reject) => (finish = reject)));
        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Радиусы' }));
        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Имя токена' }), { target: { value: 'xxxl' } });
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Значение, px' }), { target: { value: '40' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Создать токен' }));
        await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Создать токен' })).toBeDisabled());
        await act(async () => finish(new SizeTokenOperationError('invalid', 'conflict', 'TOKEN_NAME_CONFLICT')));
        expect(dialog).toHaveTextContent('Токен round.xxxl уже есть в теме.');
        expect(within(dialog).getByRole('textbox', { name: 'Имя токена' })).toHaveValue('xxxl');
        expect(within(dialog).getByRole('button', { name: 'Создать токен' })).toBeEnabled();
    });

    it('удаляет используемый токен после подтверждения, а неиспользуемый — сразу', async () => {
        const { theme } = await renderScreen();
        repository.delete.mockImplementation(async (_c, tokenId, editRevision) => ({
            editRevision: editRevision + 1,
            deletedTokenIds: [tokenId],
        }));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Удалить токен' }));
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent(
            'Токен удалится из дизайн-системы вместе со значениями во всех темах. Удаление нельзя отменить.',
        );
        expect(dialog).toHaveTextContent(
            'Используется в компонентах: Slider, EmptyState. Ссылки компонентов на токен будут сброшены.',
        );
        expect(repository.delete).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить токен' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(repository.delete.mock.calls[0][1]).toBe('id-round.m');
        expect(row('round.m')).toBeNull();
        expect(theme.getToken('round.m', 'shape')).toBeUndefined();

        fireEvent.click(row('spacing.4x'));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Удалить токен' }));
        await waitFor(() => expect(repository.delete).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(row('spacing.4x')).toBeNull();
    });

    it('удаляет тень размером целиком', async () => {
        await renderScreen();
        repository.delete.mockImplementation(async (_c, _t, editRevision) => ({
            editRevision: editRevision + 1,
            deletedTokenIds: ['id-down.soft.m', 'id-down.hard.m', 'id-up.soft.m', 'id-up.hard.m'],
        }));
        fireEvent.click(row('down.hard.m'));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Удалить токен' }));
        expect(screen.getByTestId('delete-size-token-names')).toHaveTextContent(
            'Удалятся токены down.soft.m, down.hard.m, up.soft.m, up.hard.m вместе со значениями во всех темах.',
        );
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить токен' }));
        await waitFor(() => expect(row('down.hard.m')).toBeNull());
        expect(row('up.soft.m')).toBeNull();
        expect(row('down.soft.s')).toBeInTheDocument();
    });

    it('не показывает удаление роли Editor', async () => {
        await renderScreen({ role: 'editor' });
        expect(within(inspector()).queryByRole('button', { name: 'Удалить токен' })).toBeNull();
        expect(within(tree()).getByRole('button', { name: 'Добавить токен в Радиусы' })).toBeInTheDocument();
    });

    it('в режиме просмотра показывает значения без действий и не отправляет операции', async () => {
        state = {
            ...state,
            canEdit: false,
            tokens: state.tokens.map((token) =>
                token.name === 'round.l' ? { ...token, platforms: { ios: 18 } } : token,
            ) as SizeToken[],
        };
        await renderScreen();
        expect(screen.getByTestId('size-tokens-viewer')).toHaveTextContent('Режим просмотра');
        expect(within(tree()).queryByRole('button', { name: /Добавить токен/ })).toBeNull();
        expect(valueField()).toBeDisabled();
        expect(within(inspector()).queryByRole('button', { name: 'Удалить токен' })).toBeNull();
        expect(within(inspector()).queryByRole('button', { name: 'Своё значение платформы' })).toBeNull();
        fireEvent.click(row('round.l'));
        expect(screen.getByTestId('override-ios')).toBeInTheDocument();
        expect(within(inspector()).queryByRole('button', { name: 'Убрать своё значение iOS' })).toBeNull();
        fireEvent.click(row('round.xxl'));
        expect(within(inspector()).queryByRole('button', { name: /Оставить как свои значения/ })).toBeNull();
        fireEvent.click(row('down.soft.s'));
        expect(within(inspector()).queryByRole('button', { name: '+ Добавить слой' })).toBeNull();
        // Дерево, поиск и борд работают.
        expect(within(board()).getByRole('button', { name: 'down.soft.s' })).toHaveClass('is-selected');
        expect(repository.updateValue).not.toHaveBeenCalled();
    });

    it('сохраняет записи размеров прежнего черновика и оставляет остальные записи', async () => {
        repository.create.mockImplementation(async (_c, request, editRevision) => ({
            editRevision: editRevision + 1,
            created: [dimension('radius', `round.${request.name}`, request.kind === 'shadow' ? 0 : request.valuePx)],
        }));
        const key = `ds_draft:project-1:ds-1:tenant-${tenantSeq + 1}`;
        localStorage.setItem(
            key,
            JSON.stringify({
                'round.m': { type: 'shape', values: { web: '1.25rem', ios: {}, android: {} }, enabled: true },
                'round.xxxl': {
                    type: 'shape',
                    values: { web: '2.5rem', ios: {}, android: {} },
                    enabled: true,
                    meta: { name: 'round.xxxl', tags: ['round', 'xxxl'], displayName: 'round.xxxl' },
                },
                'dark.text.default.accent': {
                    type: 'color',
                    values: { web: '#fff', ios: '#fff', android: '#fff' },
                    enabled: true,
                },
            }),
        );
        const { theme } = await renderScreen();
        // Черновик накладывается на тему при загрузке, как в `useDesignSystem`.
        applyDraftChanges(theme, 'System', '0.1.0');
        const banner = screen.getByTestId('size-tokens-legacy-draft');
        expect(banner).toHaveTextContent('В черновике есть несохранённые правки радиусов, отступов и теней: 2');
        fireEvent.click(within(banner).getByRole('button', { name: 'Сохранить' }));
        await waitFor(() => expect(screen.queryByTestId('size-tokens-legacy-draft')).toBeNull());
        expect(repository.updateValue.mock.calls[0].slice(1, 3)).toEqual([
            'id-round.m',
            { kind: 'dimension', valuePx: 20, platforms: {} },
        ]);
        expect(repository.create.mock.calls[0][1]).toEqual({ kind: 'radius', name: 'xxxl', valuePx: 40 });
        expect(Object.keys(JSON.parse(localStorage.getItem(key) ?? '{}'))).toEqual(['dark.text.default.accent']);
    });

    it('отбрасывает записи размеров прежнего черновика и перечитывает тему', async () => {
        const key = `ds_draft:project-1:ds-1:tenant-${tenantSeq + 1}`;
        localStorage.setItem(
            key,
            JSON.stringify({
                'spacing.4x': { type: 'spacing', values: { web: '1rem', ios: {}, android: {} }, enabled: true },
                'dark.text.default.accent': {
                    type: 'color',
                    values: { web: '#fff', ios: '#fff', android: '#fff' },
                    enabled: true,
                },
            }),
        );
        const { reload } = await renderScreen();
        fireEvent.click(
            within(screen.getByTestId('size-tokens-legacy-draft')).getByRole('button', { name: 'Отбросить' }),
        );
        expect(screen.queryByTestId('size-tokens-legacy-draft')).toBeNull();
        expect(reload).toHaveBeenCalled();
        expect(Object.keys(JSON.parse(localStorage.getItem(key) ?? '{}'))).toEqual(['dark.text.default.accent']);
        expect(repository.updateValue).not.toHaveBeenCalled();
    });
});
