import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesignSystem, Theme } from '../../controllers';
import { getDraftAutosaveStatus } from '../../api/draftAutosaveActivity';
import {
    createHttpSizeTokenRepository,
    setSizeTokenRepository,
    SizeTokenOperationError,
    themeValuesFromToken,
    toRem,
    type DimensionToken,
    type ShadowLayer,
    type ShadowToken,
    type SizeToken,
    type SizeTokenCommand,
    type SizeTokenContext,
    type SizeTokenRepository,
    type SizeTokenResult,
    type SizeTokens,
} from '../../modules/sizeTokens';
import type { ThemePalette } from '../../modules/palette';
import { SizeTokensScreen } from './SizeTokensScreen';

vi.mock('../../api/tokenRepository', () => ({
    tokenRepository: {
        async listDefinitions() {
            return [
                { id: 'id-round.l', name: 'round.l' },
                { id: 'id-down.hard.m', name: 'down.hard.m' },
                { id: 'id-text.default.primary', name: 'text.default.primary' },
            ];
        },
    },
}));

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
    shadow('down.hard.m', [layer(6, 12, '#00000029')], {
        components: [
            { name: 'Popover', count: 1 },
            { name: 'Select', count: 2 },
        ],
    }),
    shadow('up.soft.m', [layer(-8, 24)], { fallbackElevation: 0 }),
    shadow('up.hard.m', [layer(-6, 12)], { fallbackElevation: 0, components: [{ name: 'Select', count: 1 }] }),
];

interface UpdateBody {
    valuePx?: number;
    layers?: ShadowLayer[];
    fallbackElevation?: number;
    platforms: Partial<Record<'ios' | 'android', number | { layers: ShadowLayer[] }>>;
}

/** Палитра темы с одной растяжкой: Gray 900 — `#1A1A1A`. */
const PALETTE: ThemePalette = {
    tenantId: 'tenant',
    editRevision: 0,
    canEdit: true,
    offBrand: false,
    groups: [{ id: 'neutral', kind: 'system', systemKey: 'neutral', label: 'Neutral', ramps: [] }],
    tokens: [],
    template: [{ type: 'general', shade: 'gray', steps: [{ step: 900, value: '#1A1A1A' }] }],
};

/** Ссылка цвета слоя раскрывается в HEX ступени, как в ответе `ds-service`: `color` и `colorRef`. */
const resolveLayer = (layer: ShadowLayer): ShadowLayer => {
    const match = /^\[general\.gray\.900\](?:\[([\d.]+)\])?$/.exec(layer.color);
    if (!match) return layer;
    const alpha = Math.round(Number(match[1] ?? 1) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return { ...layer, color: `#1A1A1A${alpha}`, colorRef: layer.color };
};

/** Ответ изменения по телу команды: токен в формате чтения с новым значением. */
const applyBody = (token: SizeToken, body: UpdateBody): SizeToken => {
    if (token.kind === 'shadow') {
        const own = (platform: 'ios' | 'android') =>
            (body.platforms[platform] as { layers: ShadowLayer[] } | undefined)?.layers.map(resolveLayer);
        const layers = (body.layers ?? token.layers).map(resolveLayer);
        return {
            ...token,
            layers,
            fallbackElevation: body.fallbackElevation ?? token.fallbackElevation,
            platforms: Object.fromEntries(
                (['ios', 'android'] as const).flatMap((platform) =>
                    own(platform) ? [[platform, { layers: own(platform)! }]] : [],
                ),
            ),
            native: { ios: { layers: own('ios') ?? layers }, android: { layers: own('android') ?? layers } },
            platformsDiffer: false,
        };
    }
    const valuePx = body.valuePx ?? token.valuePx ?? 0;
    const platforms = body.platforms as Partial<Record<'ios' | 'android', number>>;
    return {
        ...token,
        valuePx,
        platforms,
        native: { ios: platforms.ios ?? valuePx, android: platforms.android ?? valuePx },
        platformsDiffer: false,
        derived: token.derived.map((item) => ({ ...item, valuePx: Math.max(0, valuePx + item.offsetPx) })),
    };
};

let state: SizeTokens;
const http = createHttpSizeTokenRepository();
const repository = {
    load: vi.fn<SizeTokenRepository['load']>(),
    command: vi.fn<SizeTokenRepository['command']>((context, operation) => http.command(context, operation)),
    send: vi.fn<(context: SizeTokenContext, command: SizeTokenCommand) => Promise<SizeTokenResult>>(),
};
const sent = (operation: SizeTokenCommand['operation']) =>
    repository.send.mock.calls.map(([, command]) => command).filter((command) => command.operation === operation);
const updates = () => sent('update').map((command) => command.body as UpdateBody);

const respond = async (_: SizeTokenContext, command: SizeTokenCommand): Promise<SizeTokenResult> => {
    if (command.operation === 'update') {
        const token = applyBody(
            state.tokens.find((item) => item.tokenId === command.tokenId)!,
            command.body as UpdateBody,
        );
        state = { ...state, tokens: state.tokens.map((item) => (item.tokenId === token.tokenId ? token : item)) };
        const values = themeValuesFromToken(token)!;
        return {
            type: 'update',
            token,
            values: (['web', 'ios', 'android'] as const).map((platform) => ({
                platform,
                value: ([] as unknown[]).concat(values[platform]),
                overridden: platform !== 'web' && token.platforms[platform] !== undefined,
            })),
        };
    }
    if (command.operation === 'delete') return { type: 'delete', deletedTokenIds: [command.tokenId!] };
    const request = command.body as
        | { kind: 'radius' | 'spacing'; name: string; valuePx: number }
        | { kind: 'shadow'; name: string; variants: Array<{ variant: string; layers: ShadowLayer[] }> };
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
    return { type: 'create', created };
};

/** Модель темы: значения платформ по имени токена. */
const themeModel = () => {
    const values = new Map<string, Record<string, unknown>>();
    const token = (name: string) => ({
        setValue: (platform: string, value: unknown) =>
            values.set(name, { ...(values.get(name) ?? {}), [platform]: value }),
        getValue: (platform: string) => values.get(name)?.[platform],
    });
    const theme = {
        getName: () => 'base_default',
        getToken: (name: string) => (values.has(name) ? token(name) : undefined),
        addToken: (_: string, added: { getName: () => string }) => values.set(added.getName(), {}),
        removeToken: (name: string) => values.delete(name),
    };
    state.tokens.forEach((item) => values.set(item.name, {}));
    return { theme: theme as unknown as Theme, values };
};

const LocationProbe = () => <output data-testid="location">{useLocation().search}</output>;

let tenantSeq = 0;

interface MountOptions {
    palette?: ThemePalette | null;
    role?: string;
    readOnly?: boolean;
    versionId?: string;
    route?: string;
}

const renderScreen = async ({
    role = 'maintainer',
    readOnly = false,
    versionId,
    route = '/',
    palette = null,
}: MountOptions = {}) => {
    // Отдельная тема на каждый тест: сессии автосохранения хранятся по контексту темы.
    const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: `tenant-${++tenantSeq}`, versionId };
    const parameters = { readOnly, effectiveRole: role };
    const designSystem = { getName: () => 'System', getParameters: () => parameters } as unknown as DesignSystem;
    const model = themeModel();
    const rerender = vi.fn();
    const view = (theme: Theme) => (
        <MemoryRouter initialEntries={[route]}>
            <SizeTokensScreen
                context={context}
                designSystem={designSystem}
                theme={theme}
                palette={palette}
                rerender={rerender}
            />
            <LocationProbe />
        </MemoryRouter>
    );
    const result = render(view(model.theme));
    await screen.findByTestId('size-tokens-screen');
    /** Новая модель темы — как после сигнала об изменении черновика в другом месте. */
    const replaceTheme = () => result.rerender(view(themeModel().theme));
    return { context, values: model.values, rerender, replaceTheme };
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
    state = { canEdit: true, tokens: fixture() };
    repository.load.mockReset().mockImplementation(async () => structuredClone(state));
    repository.command.mockClear();
    repository.send.mockReset().mockImplementation(respond);
    setSizeTokenRepository(repository);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
        expect(screen.queryByTestId('size-tokens-legacy-draft')).toBeNull();
    });

    it('выбирает токен в дереве и на борде', async () => {
        await renderScreen();
        fireEvent.click(row('spacing.4x'));
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Отступы / 4x');
        expect(valueField()).toHaveValue('8');
        fireEvent.click(row('down.soft.m'));
        fireEvent.click(within(board()).getByRole('button', { name: 'up.hard.m' }));
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Тени / Up Hard M');
        expect(row('up.hard.m')).toHaveClass('is-selected');
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

    it('открывает токен по ?tokenId, раскрывает его раздел и заменяет адрес при выборе', async () => {
        localStorage.setItem('ds_size_tokens_collapsed', JSON.stringify({ shadow: true }));
        await renderScreen({ route: '/?tokenId=id-down.hard.m&versionId=v1' });
        await waitFor(() => expect(within(inspector()).getByRole('heading')).toHaveTextContent('Тени / Down Hard M'));
        expect(row('down.hard.m')).toHaveClass('is-selected');
        fireEvent.click(row('round.l'));
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('tokenId=id-round.l'));
        expect(screen.getByTestId('location')).toHaveTextContent('versionId=v1');
    });

    it('показывает «Точный источник токена недоступен» и не выбирает другой токен', async () => {
        await renderScreen({ route: '/?tokenId=id-text.default.primary' });
        await waitFor(() =>
            expect(screen.getByTestId('size-tokens-unavailable')).toHaveTextContent(
                'Точный источник токена недоступен.',
            ),
        );
        expect(within(inspector()).queryByRole('heading')).toBeNull();
        expect(tree().querySelector('.is-selected')).toBeNull();
    });

    it('сохраняет правку одной операцией с базовыми редакциями и обновляет модель темы', async () => {
        const { values, context, rerender } = await renderScreen();
        commit(valueField(), '13');
        commit(valueField(), '14');
        expect(saveStatus()).toHaveTextContent('Сохранение…');
        expect(getDraftAutosaveStatus(context)).toBe('pending');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));
        expect(updates()).toEqual([{ valuePx: 14, platforms: {}, baseRevisions: { web: 0, ios: 0, android: 0 } }]);
        expect(sent('update')[0].path).toBe(
            `/api/projects/project-1/ds/tenants/${context.tenantId}/size-tokens/id-round.m/value`,
        );
        expect(getDraftAutosaveStatus(context)).toBe('saved');
        expect(values.get('round.m')?.web).toBe(toRem(14));
        expect(rerender).toHaveBeenCalled();
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
        await waitFor(() => expect(updates()).toHaveLength(1));
        expect(updates()[0]).toMatchObject({ valuePx: 16, platforms: { android: 18 } });
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));

        // Правка веба оставляет своё значение Android.
        commit(valueField(), '20');
        await waitFor(() => expect(updates()).toHaveLength(2));
        expect(updates()[1]).toMatchObject({ valuePx: 20, platforms: { android: 18 } });
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));
        expect(screen.getByRole('textbox', { name: 'Значение Android, px' })).toHaveValue('18');

        fireEvent.click(within(inspector()).getByRole('button', { name: 'Своё значение платформы' }));
        fireEvent.click(within(inspector()).getByRole('menuitem', { name: 'iOS' }));
        expect(within(inspector()).getByRole('button', { name: 'Своё значение платформы' })).toBeDisabled();

        fireEvent.click(within(inspector()).getByRole('button', { name: 'Убрать своё значение Android' }));
        expect(screen.queryByTestId('override-android')).toBeNull();
        await waitFor(() => expect(updates()).toHaveLength(3));
        expect(updates()[2]).toMatchObject({ valuePx: 20, platforms: { ios: 20 } });
        expect(updates()[2].platforms).not.toHaveProperty('android');
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
        await waitFor(() => expect(updates()).toHaveLength(1));
        expect(updates()[0]).toMatchObject({ valuePx: 32, platforms: { ios: 40, android: 40 } });
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
        expect(repository.send).not.toHaveBeenCalled();

        repository.send.mockRejectedValueOnce(
            new SizeTokenOperationError(
                'invalid',
                'Значение должно быть в диапазоне 0–1000 px.',
                'INVALID_SIZE_VALUE',
                'valuePx',
            ),
        );
        commit(valueField(), '999');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Не сохранено'));
        expect(within(saveStatus()).queryByRole('button', { name: 'Повторить' })).toBeNull();
        expect(inspector().querySelector('.st-field-error')).toHaveTextContent(
            'Значение должно быть в диапазоне 0–1000 px.',
        );
        expect(valueField()).toHaveValue('999');
        expect(row('round.m')).toHaveTextContent('12 px');
    });

    it('при ошибке сети оставляет ввод, повторяет отправку и отправляет сразу по «Повторить»', async () => {
        await renderScreen();
        repository.send.mockRejectedValueOnce(new SizeTokenOperationError('network', 'Сервис недоступен'));
        commit(valueField(), '15');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Не сохранено'));
        expect(valueField()).toHaveValue('15');
        fireEvent.click(within(saveStatus()).getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));
        expect(repository.send).toHaveBeenCalledTimes(2);
        // «Повторить» отправляет ту же правку, а автоматический повтор не отправляет её ещё раз.
        await act(() => new Promise((done) => setTimeout(done, 1_100)));
        expect(repository.send).toHaveBeenCalledTimes(2);
    });

    it('перечитывает раздел по новой модели темы только после отправки очереди', async () => {
        const { replaceTheme } = await renderScreen();
        expect(repository.load).toHaveBeenCalledTimes(1);
        let finish: (result: SizeTokenResult) => void = () => undefined;
        repository.send.mockImplementationOnce((context, command) =>
            new Promise((resolve) => (finish = resolve)).then(() => respond(context, command)),
        );
        commit(valueField(), '15');
        state = {
            ...state,
            tokens: state.tokens.map((token) => (token.name === 'spacing.4x' ? { ...token, valuePx: 10 } : token)),
        };
        replaceTheme();
        await act(() => new Promise((done) => setTimeout(done, 450)));
        expect(repository.load).toHaveBeenCalledTimes(1);
        // Локальный ввод не заменяется.
        expect(valueField()).toHaveValue('15');
        await act(async () => finish(undefined as never));
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(row('spacing.4x')).toHaveTextContent('10 px'));
        expect(row('round.m')).toHaveTextContent('15 px');
    });

    it('правит слой тени, цвет и свои слои iOS', async () => {
        await renderScreen();
        fireEvent.click(row('down.hard.m'));
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Тени / Down Hard M');
        // Один слой: удалить его нельзя.
        expect(within(inspector()).queryByRole('button', { name: 'Удалить слой 1' })).toBeNull();

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, Y' }), '10');
        await waitFor(() => expect(updates()).toHaveLength(1));
        expect(updates()[0]).toEqual({
            layers: [{ ...layer(6, 12, '#00000029'), offsetY: 10 }],
            fallbackElevation: 4,
            platforms: {},
            baseRevisions: { web: 0, ios: 0, android: 0 },
        });

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, HEX' }), '#000000');
        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, прозрачность' }), '24%');
        await waitFor(() => expect(updates()).toHaveLength(2));
        expect(updates()[1].layers?.[0].color).toBe('#0000003D');

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, Blur' }), '-1');
        expect(inspector()).toHaveTextContent('Blur: Значение должно быть в диапазоне 0–200 px.');

        fireEvent.click(within(inspector()).getByRole('button', { name: 'Свои слои платформы' }));
        fireEvent.click(within(inspector()).getByRole('menuitem', { name: 'iOS' }));
        const own = screen.getByTestId('override-layers-ios');
        expect(own).toHaveTextContent('↳ iOS · СВОИ СЛОИ');
        commit(within(own).getByRole('textbox', { name: 'iOS, слой 1, X' }), '3');
        await waitFor(() => expect(updates()).toHaveLength(3));
        const ios = updates()[2].platforms.ios as { layers: ShadowLayer[] };
        expect(ios.layers[0].offsetX).toBe(3);
        expect(updates()[2].layers?.[0].offsetX).toBe(0);

        fireEvent.click(within(inspector()).getAllByRole('button', { name: '+ Добавить слой' })[0]);
        expect(within(inspector()).getAllByRole('button', { name: 'Удалить слой 2' })).toHaveLength(1);
        commit(within(inspector()).getByRole('textbox', { name: 'Запасная высота Android' }), '6');
        await waitFor(() => expect(updates()).toHaveLength(4));
        expect(updates()[3].layers).toHaveLength(2);
        expect(updates()[3].fallbackElevation).toBe(6);

        fireEvent.click(within(own).getByRole('button', { name: 'Убрать свои слои iOS' }));
        await waitFor(() => expect(updates()).toHaveLength(5));
        expect(updates()[4].platforms).toEqual({});
    });

    it('выбирает цвет слоя из палитры ссылкой на ступень и заменяет ссылку HEX-цветом', async () => {
        await renderScreen({ palette: PALETTE });
        fireEvent.click(row('down.hard.m'));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Веб, слой 1, выбор цвета' }));
        const picker = screen.getByRole('dialog', { name: 'Color picker: down.hard.m, слой 1' });
        fireEvent.click(within(picker).getByRole('button', { name: 'Library' }));
        fireEvent.click(within(picker).getByRole('button', { name: 'Gray 900 #1A1A1A' }));
        // Прозрачность слоя (16 %) сохраняется в ссылке.
        expect(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, HEX' })).toHaveValue('Gray 900');
        expect(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, прозрачность' })).toHaveValue('16');
        await waitFor(() => expect(updates()).toHaveLength(1));
        expect(updates()[0].layers?.[0].color).toBe('[general.gray.900][0.16]');
        await waitFor(() => expect(saveStatus()).toHaveTextContent('Сохранено'));
        expect(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, HEX' })).toHaveValue('Gray 900');
        expect(
            within(inspector())
                .getByRole('button', { name: 'Веб, слой 1, выбор цвета' })
                .style.getPropertyValue('--swatch-color'),
        ).toBe('#1A1A1A29');

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, прозрачность' }), '24');
        await waitFor(() => expect(updates()).toHaveLength(2));
        expect(updates()[1].layers?.[0].color).toBe('[general.gray.900][0.24]');

        commit(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, HEX' }), '000000');
        await waitFor(() => expect(updates()).toHaveLength(3));
        expect(updates()[2].layers?.[0].color).toBe('#0000003D');
        expect(within(inspector()).getByRole('textbox', { name: 'Веб, слой 1, HEX' })).toHaveValue('000000');
    });

    it('создаёт радиус, отступ и размер тени строкой внизу раздела, как в «Цветах»', async () => {
        await renderScreen();
        // «+» раздела живёт в строке заголовка: правила показывают его при наведении и фокусе на эту строку.
        const add = within(tree()).getByRole('button', { name: 'Добавить токен в Радиусы' });
        expect(add.parentElement).toHaveClass('token-tree-heading-row');
        expect(add.parentElement).toContainElement(within(tree()).getByRole('button', { name: 'Радиусы' }));
        fireEvent.click(add);
        expect(screen.queryByRole('dialog')).toBeNull();
        const section = screen.getByTestId('size-section-radius');
        let input = within(section).getByRole('textbox', { name: 'Имя нового токена' });
        // Строка нового токена — последняя в разделе.
        expect(section.lastElementChild).toContainElement(input);
        fireEvent.change(input, { target: { value: 'M' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(section).toHaveTextContent('Токен round.m уже есть в теме.');
        expect(sent('create')).toHaveLength(0);
        fireEvent.change(input, { target: { value: 'XXXL' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(within(section).queryByRole('textbox', { name: 'Имя нового токена' })).toBeNull());
        // Значение по умолчанию — самый крупный радиус шкалы; правится потом в инспекторе.
        expect(sent('create')[0]).toMatchObject({
            method: 'POST',
            body: { kind: 'radius', name: 'xxxl', valuePx: 32 },
            idempotencyKey: expect.any(String),
        });
        expect(within(inspector()).getByRole('heading')).toHaveTextContent('Радиусы / XXXL');
        expect(row('round.xxxl')).toHaveClass('is-selected');

        // Имя отступа по правилу темы задаёт значение: 14x → 28 px; другое имя — самый крупный отступ.
        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Отступы' }));
        input = within(screen.getByTestId('size-section-spacing')).getByRole('textbox', { name: 'Имя нового токена' });
        fireEvent.change(input, { target: { value: '14x' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(sent('create')).toHaveLength(2));
        expect(sent('create')[1].body).toEqual({ kind: 'spacing', name: '14x', valuePx: 28 });
        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Отступы' }));
        input = within(screen.getByTestId('size-section-spacing')).getByRole('textbox', { name: 'Имя нового токена' });
        fireEvent.change(input, { target: { value: 'wide' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(sent('create')).toHaveLength(3));
        expect(sent('create')[2].body).toEqual({ kind: 'spacing', name: 'wide', valuePx: 28 });

        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Тени' }));
        input = within(screen.getByTestId('size-section-shadow')).getByRole('textbox', { name: 'Имя нового токена' });
        fireEvent.change(input, { target: { value: 'xl' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(sent('create')).toHaveLength(4));
        const request = sent('create')[3].body as { kind: string; name: string; variants: unknown[] };
        expect(request).toMatchObject({ kind: 'shadow', name: 'xl' });
        expect(request.variants[2]).toEqual({ variant: 'up.soft', layers: [layer(-8, 24)], fallbackElevation: 0 });
        await waitFor(() => expect(row('down.soft.xl')).toHaveClass('is-selected'));
    });

    it('закрывает строку нового токена по Escape без запроса', async () => {
        await renderScreen();
        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Радиусы' }));
        const input = within(tree()).getByRole('textbox', { name: 'Имя нового токена' });
        fireEvent.change(input, { target: { value: 'xxxl' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(within(tree()).queryByRole('textbox', { name: 'Имя нового токена' })).toBeNull();
        expect(sent('create')).toHaveLength(0);
    });

    it('оставляет строку открытой с текстом отказа сервера', async () => {
        await renderScreen();
        let finish: (error: Error) => void = () => undefined;
        repository.send.mockImplementationOnce(() => new Promise((_, reject) => (finish = reject)));
        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Радиусы' }));
        const input = within(tree()).getByRole('textbox', { name: 'Имя нового токена' });
        fireEvent.change(input, { target: { value: 'xxxl' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(input).toBeDisabled());
        await act(async () => finish(new SizeTokenOperationError('invalid', 'conflict', 'TOKEN_NAME_CONFLICT')));
        expect(screen.getByTestId('size-section-radius')).toHaveTextContent('Токен round.xxxl уже есть в теме.');
        expect(input).toHaveValue('xxxl');
        expect(input).toBeEnabled();
    });

    it('повторяет создание после сбоя сети тем же ключом и телом', async () => {
        await renderScreen();
        repository.send.mockRejectedValueOnce(new SizeTokenOperationError('network', 'Сервис недоступен'));
        fireEvent.click(within(tree()).getByRole('button', { name: 'Добавить токен в Радиусы' }));
        const input = within(tree()).getByRole('textbox', { name: 'Имя нового токена' });
        fireEvent.change(input, { target: { value: 'xxxl' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(within(tree()).queryByRole('textbox', { name: 'Имя нового токена' })).toBeNull(), {
            timeout: 3_000,
        });
        const [first, second] = sent('create');
        expect(second).toBe(first);
        expect(row('round.xxxl')).toBeInTheDocument();
    });

    it('удаляет используемый токен после подтверждения, а неиспользуемый — сразу', async () => {
        const { values } = await renderScreen();
        commit(valueField(), '13');
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Удалить токен' }));
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent(
            'Токен удалится из черновика дизайн-системы вместе со значениями во всех темах. До публикации удаление можно отменить в журнале изменений.',
        );
        expect(dialog).toHaveTextContent(
            'Используется в компонентах: Slider, EmptyState. Ссылки компонентов на токен будут сброшены.',
        );
        expect(sent('delete')).toHaveLength(0);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить токен' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        // Сначала отправлена очередь автосохранения, затем удаление.
        expect(repository.send.mock.calls.map(([, command]) => command.operation)).toEqual(['update', 'delete']);
        expect(sent('delete')[0]).toMatchObject({ method: 'DELETE', tokenId: 'id-round.m' });
        expect(row('round.m')).toBeNull();
        expect(values.has('round.m')).toBe(false);

        fireEvent.click(row('spacing.4x'));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Удалить токен' }));
        await waitFor(() => expect(sent('delete')).toHaveLength(2));
        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(row('spacing.4x')).toBeNull());
    });

    it('подтверждает удаление тени по использованию всех четырёх вариантов размера', async () => {
        await renderScreen();
        repository.send.mockImplementation(async (context, command) =>
            command.operation === 'delete'
                ? {
                      type: 'delete',
                      deletedTokenIds: ['id-down.soft.m', 'id-down.hard.m', 'id-up.soft.m', 'id-up.hard.m'],
                  }
                : respond(context, command),
        );
        // `up.soft.m` не используют компоненты, но удаляется весь размер M.
        fireEvent.click(row('up.soft.m'));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Удалить токен' }));
        expect(screen.getByTestId('delete-size-token-names')).toHaveTextContent(
            'Удалятся токены down.soft.m, down.hard.m, up.soft.m, up.hard.m из черновика дизайн-системы вместе со значениями во всех темах.',
        );
        expect(screen.getByTestId('delete-size-token-components')).toHaveTextContent(
            'Используется в компонентах: Popover (down.hard.m), Select (down.hard.m, up.hard.m). Ссылки компонентов на токен будут сброшены.',
        );
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить токен' }));
        await waitFor(() => expect(row('down.hard.m')).toBeNull());
        expect(row('up.soft.m')).toBeNull();
        expect(row('down.soft.s')).toBeInTheDocument();
        expect(board().querySelector('[aria-label="down.hard.m"]')).toBeNull();
    });

    it('удаляет тень без подтверждения, если ни один вариант размера не используют компоненты', async () => {
        await renderScreen();
        fireEvent.click(row('down.soft.s'));
        fireEvent.click(within(inspector()).getByRole('button', { name: 'Удалить токен' }));
        await waitFor(() => expect(sent('delete')).toHaveLength(1));
        expect(screen.queryByRole('dialog')).toBeNull();
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
        expect(repository.send).not.toHaveBeenCalled();
    });

    it('читает опубликованную версию с versionId и не даёт её править', async () => {
        const { context } = await renderScreen({ versionId: 'v1' });
        expect(repository.load).toHaveBeenCalledWith(expect.objectContaining({ versionId: 'v1' }));
        expect(context.versionId).toBe('v1');
        expect(screen.getByTestId('size-tokens-viewer')).toHaveTextContent('Опубликованная версия');
        expect(screen.queryByTestId('size-tokens-save-status')).toBeNull();
        expect(valueField()).toBeDisabled();
        expect(within(tree()).queryByRole('button', { name: /Добавить токен/ })).toBeNull();
        expect(within(inspector()).queryByRole('button', { name: 'Удалить токен' })).toBeNull();
        expect(repository.send).not.toHaveBeenCalled();
    });
});
