import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyEditorDataInvalidated } from '../../api/draftInvalidationStream';
import { subjectMutation } from '../../api/subjectMutation';
import type { DesignSystem, Theme } from '../../controllers';
import { getDraftAutosaveStatus, subscribeDraftAutosaveStatus } from '../../api/draftAutosaveActivity';
import {
    TypographyOperationError,
    type TypographyContext,
    type TypographyStyleRepository,
    type TypographyStyles,
} from '../../modules/typographyTokens';
import { SEARCH_EMPTY_TEXT } from '../../components/tokenWorkspace';
import { bodyM, typographyStyles, updated } from '../../modules/typographyTokens/testFixtures';
import { TypographyScreen } from './TypographyScreen';
import { setTypographyStyleRepository } from './useTypographyEditor';

const tokenReset = vi.hoisted(() => ({ reset: vi.fn(), busy: false, error: null }));
vi.mock('../../features/versionJournal/tokenReset', () => ({ useTokenReset: () => tokenReset }));
vi.mock('../../api/tokenRepository', () => ({
    tokenRepository: {
        async listDefinitions() {
            return [
                ...['screen-l', 'screen-m', 'screen-s'].flatMap((screenId) =>
                    ['normal', 'medium', 'bold'].map((variant) => ({
                        id: `id:${screenId}.body.m.${variant}`,
                        name: `${screenId}.body.m.${variant}`,
                    })),
                ),
                { id: 'id:screen-l.header.h1.normal', name: 'screen-l.header.h1.normal' },
                { id: 'id:text.default.primary', name: 'text.default.primary' },
            ];
        },
    },
}));

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };

const LocationProbe = () => <output data-testid="location">{useLocation().search}</output>;

interface MountOptions {
    update?: TypographyStyleRepository['update'];
    context?: TypographyContext;
    route?: string;
    readOnly?: boolean;
    changedTokenNames?: Set<string>;
    load?: TypographyStyleRepository['load'];
    describe?: TypographyStyleRepository['describe'];
    /** Описание токена Body M «Крупных» в модели темы. */
    description?: string;
    /** Роль в дизайн-системе: удаление стилей доступно Maintainer и Owner. */
    role?: string;
}

/**
 * Стили, где стиль [from] (`группа.имя`) стал стилем [to] со значениями Body M: как ответ чтения после создания,
 * переименования или удаления стиля; `null` — стиля нет до или после.
 */
const withStyle = (styles: TypographyStyles, from: string | null, to: string | null): TypographyStyles => ({
    ...styles,
    screens: styles.screens.map((item) => {
        const source = item.styles.find((style) => style.group === 'body' && style.size === 'm');
        const kept = item.styles.filter((style) => `${style.group}.${style.size}` !== from);
        if (!to || !source) return { ...item, styles: kept };
        const [group, size] = to.split('.');
        const variants = Object.fromEntries(
            Object.entries(source.variants).map(([name, view]) => [
                name,
                view && { ...view, tokenId: `${item.screen}.${to}.${name}` },
            ]),
        ) as typeof source.variants;
        return { ...item, styles: [...kept, { ...source, group, size, variants, components: [] }] };
    }),
});

/** Ключи стилей группы [group] на первом экране. */
const groupKeys = (styles: TypographyStyles, group: string) =>
    styles.screens[0].styles.filter((style) => style.group === group).map((style) => `${style.group}.${style.size}`);

/** Стиль токена `<экран>.<группа>.<имя>.<начертание>`. */
const keyOf = (tokenId: string) => tokenId.split('.').slice(1, 3).join('.');

const setup = (styles: TypographyStyles = typographyStyles(), update?: TypographyStyleRepository['update']) =>
    mount(styles, { update });

const mount = (styles: TypographyStyles, options: MountOptions = {}) => {
    const parameters = { readOnly: options.readOnly ?? false, effectiveRole: options.role } as Record<string, unknown>;
    let current = styles;
    const setValue = vi.fn();
    const setDescription = vi.fn();
    const designSystem = {
        getName: () => 'base',
        getParameters: () => parameters,
    } as unknown as DesignSystem;
    const createTheme = () =>
        ({
            getName: () => 'base_default',
            getToken: (name: string) => ({
                setValue,
                setDescription,
                getDescription: () => (name === 'screen-l.body.m.normal' ? options.description : undefined),
            }),
        }) as unknown as Theme;
    const repository: TypographyStyleRepository = {
        load: vi.fn(options.load ?? (async () => current)),
        create: vi.fn(async (_c: TypographyContext, group: string, size: string) => {
            current = withStyle(current, null, `${group}.${size}`);
            return [`screen-l.${group}.${size}.normal`];
        }),
        rename: vi.fn(async (_c: TypographyContext, tokenId: string, size: string) => {
            current = withStyle(current, keyOf(tokenId), `${tokenId.split('.')[1]}.${size}`);
            return [tokenId];
        }),
        remove: vi.fn(async (_c: TypographyContext, tokenId: string) => {
            current = withStyle(current, keyOf(tokenId), null);
            return [tokenId];
        }),
        renameGroup: vi.fn(async (_c: TypographyContext, group: string, name: string) => {
            groupKeys(current, group).forEach((key) => {
                current = withStyle(current, key, `${name}.${key.split('.')[1]}`);
            });
            return [];
        }),
        removeGroup: vi.fn(async (_c: TypographyContext, group: string) => {
            groupKeys(current, group).forEach((key) => {
                current = withStyle(current, key, null);
            });
            return [];
        }),
        describe: vi.fn(options.describe ?? (async () => undefined)),
        update: vi.fn(
            options.update ??
                (async (c, tokenId, change) =>
                    subjectMutation(c, async () => {
                        const screenId = tokenId.split('.')[0] as 'screen-l';
                        return updated(bodyM(screenId, { sizePx: change.size ?? 16 }));
                    })),
        ),
    };
    setTypographyStyleRepository(repository);
    const rerender = vi.fn();
    const screenContext = options.context ?? context;
    const view = (theme: Theme) => (
        <MemoryRouter initialEntries={[options.route ?? '/']}>
            <TypographyScreen
                context={screenContext}
                designSystem={designSystem}
                theme={theme}
                rerender={rerender}
                changedTokenNames={options.changedTokenNames}
            />
            <LocationProbe />
        </MemoryRouter>
    );
    const result = render(view(createTheme()));
    /** Новая модель темы — как после сигнала об изменении черновика в другом месте. */
    const replaceTheme = () => {
        notifyEditorDataInvalidated(screenContext, new Set(['theme-tokens']));
        result.rerender(view(createTheme()));
    };
    return {
        repository,
        setValue,
        setDescription,
        rerender,
        unmount: result.unmount,
        replaceTheme,
        remount: () => render(view(createTheme())),
    };
};

/** Заголовок инспектора `InspectorHeader`. */
const TITLE = '.tw-inspector-title';
const tree = () => within(document.querySelector('.typography-tree-body') as HTMLElement);
const groupHeading = (label: string) =>
    tree().getByText(label, { selector: '.typography-group-heading span' }).closest('button') as HTMLButtonElement;
const inspector = () => within(document.querySelector('.typography-inspector') as HTMLElement);

describe('экран «Типографика»', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('создаёт стиль «+» у группы, переименовывает двойным щелчком и удаляет', async () => {
        const { repository } = mount(typographyStyles(), { role: 'maintainer' });
        await screen.findByText('M', { selector: '.tw-tree-item-label' });

        fireEvent.click(screen.getByRole('button', { name: 'Добавить стиль в Body' }));
        let field = tree().getByRole('textbox', { name: 'Имя нового стиля' });
        fireEvent.change(field, { target: { value: 'M' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        await waitFor(() => expect(screen.getByText('Стиль Body M уже есть в теме.')).toBeInTheDocument());
        expect(repository.create).not.toHaveBeenCalled();
        fireEvent.change(field, { target: { value: 'XL' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        await waitFor(() => expect(repository.create).toHaveBeenCalledWith(context, 'body', 'xl'));
        await waitFor(() => expect(document.querySelector(TITLE)).toHaveTextContent('Body / XL'));

        fireEvent.doubleClick(document.querySelector('[data-style-key="body.xl"]') as HTMLElement);
        field = tree().getByRole('textbox', { name: 'Новое имя Body XL' });
        expect(field).toHaveValue('xl');
        fireEvent.change(field, { target: { value: 'xxl' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        await waitFor(() => expect(repository.rename).toHaveBeenCalledWith(context, 'screen-l.body.xl.normal', 'xxl'));
        await waitFor(() => expect(document.querySelector(TITLE)).toHaveTextContent('Body / XXL'));

        // Шапка инспектора правит размер стиля.
        fireEvent.doubleClick(inspector().getByRole('button', { name: 'Имя токена' }));
        expect(inspector().getByRole('textbox', { name: 'Имя токена' })).toHaveValue('xxl');
        fireEvent.keyDown(inspector().getByRole('textbox', { name: 'Имя токена' }), { key: 'Escape' });

        // Удаление всегда подтверждается, и для стиля без компонентов тоже.
        fireEvent.click(inspector().getByRole('button', { name: 'Удалить стиль' }));
        const unused = await screen.findByRole('dialog');
        expect(unused).toHaveTextContent('Стиль не используется в компонентах дизайн-системы.');
        expect(repository.remove).not.toHaveBeenCalled();
        fireEvent.click(within(unused).getByRole('button', { name: 'Удалить стиль' }));
        await waitFor(() => expect(repository.remove).toHaveBeenCalledWith(context, 'screen-l.body.xxl.normal'));
        await waitFor(() => expect(document.querySelector('[data-style-key="body.xxl"]')).toBeNull());
        fireEvent.click(tree().getByRole('button', { name: 'Удалить стиль Body M' }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('Удалить стиль?');
        expect(repository.remove).toHaveBeenCalledTimes(1);
    });

    it('показывает ошибку удаления в окне подтверждения', async () => {
        const { repository } = mount(typographyStyles(), { role: 'maintainer' });
        await screen.findByText('M', { selector: '.tw-tree-item-label' });
        vi.mocked(repository.remove).mockRejectedValueOnce(new Error('Удаление отклонено'));

        fireEvent.click(tree().getByRole('button', { name: 'Удалить стиль Header H1' }));
        const dialog = await screen.findByRole('dialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить стиль' }));

        expect(await within(dialog).findByText(/Удаление отклонено/)).toBeInTheDocument();
    });

    it('создаёт свою группу с первым стилем, переименовывает и удаляет её; системные группы не меняются', async () => {
        const { repository } = mount(typographyStyles(), { role: 'maintainer' });
        await screen.findByText('M', { selector: '.tw-tree-item-label' });

        fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
        let field = tree().getByRole('textbox', { name: 'Имя новой группы' });
        fireEvent.change(field, { target: { value: 'Body' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(await screen.findByText('Группа Body уже есть в теме.')).toBeInTheDocument();
        fireEvent.change(field, { target: { value: 'Caption' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        // Группа видна до первого стиля и создаётся на сервере вместе с ним.
        expect(screen.getByTestId('typography-group-caption')).toBeInTheDocument();
        field = tree().getByRole('textbox', { name: 'Имя нового стиля' });
        fireEvent.change(field, { target: { value: 'Promo title' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        await waitFor(() => expect(repository.create).toHaveBeenCalledWith(context, 'caption', 'promo-title'));
        await waitFor(() => expect(document.querySelector(TITLE)).toHaveTextContent('Caption / promo-title'));

        // Системную группу не переименовать двойным щелчком и не удалить.
        fireEvent.doubleClick(
            within(screen.getByTestId('typography-group-body')).getByRole('button', { name: 'Body' }),
        );
        expect(tree().queryByRole('textbox', { name: 'Новое имя группы Body' })).toBeNull();
        expect(tree().queryByRole('button', { name: 'Удалить группу Body' })).toBeNull();

        fireEvent.doubleClick(
            within(screen.getByTestId('typography-group-caption')).getByRole('button', { name: 'Caption' }),
        );
        field = tree().getByRole('textbox', { name: 'Новое имя группы Caption' });
        fireEvent.change(field, { target: { value: 'note' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        await waitFor(() => expect(repository.renameGroup).toHaveBeenCalledWith(context, 'caption', 'note'));
        await waitFor(() => expect(document.querySelector(TITLE)).toHaveTextContent('Note / promo-title'));

        fireEvent.click(tree().getByRole('button', { name: 'Удалить группу Note' }));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('Удалить группу?');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить группу' }));
        await waitFor(() => expect(repository.removeGroup).toHaveBeenCalledWith(context, 'note'));
        await waitFor(() => expect(screen.queryByTestId('typography-group-note')).toBeNull());
    });

    it('отменённая новая группа без стилей пропадает из дерева', async () => {
        mount(typographyStyles(), { role: 'maintainer' });
        await screen.findByText('M', { selector: '.tw-tree-item-label' });
        fireEvent.click(screen.getByRole('button', { name: 'Добавить группу' }));
        const field = tree().getByRole('textbox', { name: 'Имя новой группы' });
        fireEvent.change(field, { target: { value: 'caption' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        fireEvent.keyDown(tree().getByRole('textbox', { name: 'Имя нового стиля' }), { key: 'Escape' });
        expect(screen.queryByTestId('typography-group-caption')).toBeNull();
    });

    it('не показывает создание и удаление без прав и в режиме просмотра', async () => {
        mount(typographyStyles(), { role: 'editor' });
        await screen.findByText('M', { selector: '.tw-tree-item-label' });
        expect(screen.getByRole('button', { name: 'Добавить стиль в Body' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Удалить стиль' })).toBeNull();
        cleanup();
        mount(typographyStyles(), { role: 'owner', readOnly: true });
        await screen.findByText('M', { selector: '.tw-tree-item-label' });
        expect(screen.queryByRole('button', { name: 'Добавить стиль в Body' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Удалить стиль' })).toBeNull();
    });

    it('помечает изменённый стиль в дереве', async () => {
        mount(typographyStyles(), { changedTokenNames: new Set(['screen-l.body.m.bold']) });
        expect(await screen.findByText('Body / M', { selector: TITLE })).toBeTruthy();
        const row = tree().getByRole('button', { name: /^M/ });
        expect(within(row).getByLabelText('Есть изменения')).toBeTruthy();
    });

    it('открывается на «Крупных» с выбранным Body M: дерево, борд и инспектор', async () => {
        setup();
        expect(await screen.findByText('Body / M', { selector: TITLE })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Крупные' }).getAttribute('aria-selected')).toBe('true');
        expect(tree().getByText('M').closest('button')?.textContent).toContain('16/20');
        expect(tree().getByText('H1')).toBeTruthy();
        const row = screen.getByRole('button', { name: 'Body M, 16 px, 20 px line' });
        expect(row.textContent).toContain('Съешь ещё этих мягких французских булок');
        expect(row.textContent).toContain('строка 20 px');
        expect(row.textContent).toContain('W 400·500·600');
        expect(inspector().getByText('Темы').textContent).toContain('2');
        expect(inspector().getByText('Список компонентов · 11 экземпляров')).toBeTruthy();
    });

    it('переключает экран, сохраняет выбор и возвращается к Body M, если стиля нет', async () => {
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        fireEvent.click(tree().getByText('H1'));
        expect(screen.getByText('Header / H1', { selector: TITLE })).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Средние' }));
        expect(screen.getByText('Header / H1', { selector: TITLE })).toBeTruthy();
        expect(tree().getByText('H1').closest('button')?.textContent).toContain('40/44');
        fireEvent.click(screen.getByRole('tab', { name: 'Мелкие' }));
        expect(screen.getByText('Body / M', { selector: TITLE })).toBeTruthy();
        expect(tree().getByText('M').closest('button')?.textContent).toContain('14/20');
    });

    it('ищет и сворачивает группы', async () => {
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        fireEvent.click(groupHeading('Body'));
        expect(tree().queryByText('M')).toBeNull();
        fireEvent.click(groupHeading('Body'));
        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        fireEvent.change(screen.getByLabelText('Найти токен'), { target: { value: 'h1' } });
        expect(tree().queryByText('M')).toBeNull();
        expect(tree().getByText('H1')).toBeTruthy();
    });

    it('does not reload styles solely because the theme object changes locally', async () => {
        const { repository } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        expect(repository.load).toHaveBeenCalledOnce();
        // Обычная подтверждённая правка не является удалённой инвалидацией.
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        await waitFor(() => expect(repository.update).toHaveBeenCalledOnce());
        await waitFor(() => expect(getDraftAutosaveStatus(context)).toBe('saved'));
        expect(repository.load).toHaveBeenCalledOnce();
    });

    it('сохраняет размер выбранного экрана с базовыми редакциями значений стиля и обновляет модель темы', async () => {
        let savedAt: number | undefined;
        const unsubscribe = subscribeDraftAutosaveStatus(context, (_status, timestamp) => {
            savedAt = timestamp;
        });
        const beforeSave = savedAt ?? 0;
        const { repository, setValue, rerender } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        // Состояние сохранения показывает индикатор черновика в шапке редактора, своего у экрана нет.
        expect(screen.queryByTestId('typography-save-status')).toBeNull();
        expect(getDraftAutosaveStatus(context)).toBe('pending');
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        const [, tokenId, change, values] = vi.mocked(repository.update).mock.calls[0];
        expect([tokenId, change]).toEqual(['screen-l.body.m.normal', { size: 18 }]);
        // Значения Body M трёх экранов: три начертания × три платформы на каждом.
        expect(values).toHaveLength(27);
        expect(values).toContainEqual({ tokenId: 'screen-s.body.m.bold', platform: 'android' });
        await waitFor(() => expect(getDraftAutosaveStatus(context)).toBe('saved'));
        expect(savedAt).toBeGreaterThan(beforeSave);
        expect(setValue).toHaveBeenCalledWith('web', { fontSize: '1.125rem' });
        expect(rerender).toHaveBeenCalled();
        expect(tree().getByText('M').closest('button')?.textContent).toContain('18/20');
        unsubscribe();
    });

    it('выбирает семейство из семейств дизайн-системы и меняет вес начертания', async () => {
        const { repository } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        fireEvent.click(inspector().getByLabelText('Семейство шрифта'));
        const options = within(inspector().getByRole('listbox', { name: 'Семейства' })).getAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual(['Display SB Sans Display', 'Body SB Sans Text']);
        fireEvent.click(options[0]);
        fireEvent.click(inspector().getByLabelText('Начертание'));
        const variants = within(inspector().getByRole('listbox', { name: 'Начертание' })).getAllByRole('option');
        expect(variants.map((option) => option.textContent)).toEqual(['Regular', 'Medium', 'Bold']);
        expect(inspector().getByLabelText('Weight Regular').textContent).toBe('400');
        fireEvent.click(variants[2]);
        expect(inspector().queryByRole('listbox', { name: 'Начертание' })).toBeNull();
        expect(inspector().getByLabelText('Weight Bold').textContent).toBe('600');
        // Образцы борда рисуются весом выбранного начертания.
        const sample = document.querySelector(
            '.typography-board-row.is-selected .typography-visible-sample',
        ) as HTMLElement;
        expect(sample.style.fontWeight).toBe('600');
        fireEvent.click(inspector().getByLabelText('Weight Bold'));
        fireEvent.click(
            within(inspector().getByRole('listbox', { name: 'Weight Bold' })).getByRole('option', {
                name: '700 / Bold',
            }),
        );
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0][2]).toEqual({
            fontFamily: 'display',
            weights: { bold: 700 },
        });
    });

    it('задаёт и снимает своё значение платформы у поля', async () => {
        const { repository } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        // «+» есть у веса, размера, высоты строки и трекинга.
        const add = inspector().getAllByRole('button', { name: 'Своё значение платформы' });
        expect(add).toHaveLength(4);
        fireEvent.click(add[1]);
        fireEvent.click(inspector().getByRole('menuitem', { name: 'iOS' }));
        const ios = inspector().getByLabelText('Size iOS') as HTMLInputElement;
        expect(ios.value).toBe('16');
        expect(inspector().getByText('↳ iOS')).toBeTruthy();
        fireEvent.change(ios, { target: { value: '17' } });
        fireEvent.blur(ios);
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0].slice(1, 3)).toEqual([
            'screen-l.body.m.normal',
            { platform: 'ios', size: 17 },
        ]);
        // У размера осталась одна платформа для «+»: Android.
        fireEvent.click(inspector().getAllByRole('button', { name: 'Своё значение платформы' })[1]);
        expect(
            inspector()
                .getAllByRole('menuitem')
                .map((item) => item.textContent),
        ).toEqual(['Android']);
    });

    it('снимает сохранённое своё значение платформы значением веба', async () => {
        const styles = typographyStyles();
        const body = styles.screens[0].styles.find((style) => style.group === 'body')!;
        body.overrides = { android: { lineHeightPx: 22 } };
        const { repository } = setup(styles);
        await screen.findByText('Body / M', { selector: TITLE });
        expect((inspector().getByLabelText('Line Height Android') as HTMLInputElement).value).toBe('22');
        fireEvent.click(inspector().getByRole('button', { name: 'Убрать своё значение Android' }));
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0][2]).toEqual({ platform: 'android', lineHeight: 20 });
        expect(inspector().queryByLabelText('Line Height Android')).toBeNull();
    });

    it('показывает ошибку значения у поля и не отправляет его', async () => {
        const { repository } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '-5' } });
        fireEvent.blur(size);
        expect(inspector().getByRole('alert').textContent).toBe(
            'Размер и межстрочный интервал должны быть положительными числами.',
        );
        expect(tree().getByText('M').closest('button')?.textContent).toContain('16/20');
        await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('показывает ошибку сервера у поля', async () => {
        setup(typographyStyles(), async () => {
            throw new TypographyOperationError(
                'invalid',
                'Letter spacing должен быть в диапазоне от -0.2em до 1em.',
                'INVALID_TYPOGRAPHY_VALUE',
                'letterSpacing',
            );
        });
        await screen.findByText('Body / M', { selector: TITLE });
        const spacing = inspector().getByLabelText('Letter Spacing');
        fireEvent.change(spacing, { target: { value: '0.5' } });
        fireEvent.blur(spacing);
        expect(await inspector().findByText('Letter spacing должен быть в диапазоне от -0.2em до 1em.')).toBeTruthy();
    });

    it('при ошибке сети оставляет значение, повторяет автоматически и по «Повторить»', async () => {
        let failures = 2;
        const { repository } = setup(typographyStyles(), async (_c, _tokenId, change) => {
            if (failures-- > 0)
                throw new TypographyOperationError('network', 'Сервис недоступен, изменения не сохранены');
            return updated(bodyM('screen-l', { sizePx: change.size ?? 16 }));
        });
        await screen.findByText('Body / M', { selector: TITLE });
        const size = inspector().getByLabelText('Size') as HTMLInputElement;
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        await screen.findByTestId('typography-save-error');
        expect(size.value).toBe('18');
        expect(getDraftAutosaveStatus(context)).toBe('error');
        // Первый повтор — автоматически через секунду.
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(2), { timeout: 2_000 });
        const banner = await screen.findByTestId('typography-save-error');
        fireEvent.click(within(banner).getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(screen.queryByTestId('typography-save-error')).toBeNull());
        expect(repository.update).toHaveBeenCalledTimes(3);
        expect(getDraftAutosaveStatus(context)).toBe('saved');
    });

    it('перечитывает стили, когда модель темы обновилась после изменения в другом месте', async () => {
        const changed = typographyStyles({
            screens: typographyStyles().screens.map((item) => ({
                ...item,
                styles: item.styles.map((style) => (style.group === 'body' ? { ...style, sizePx: 22 } : style)),
            })),
        });
        const { repository, replaceTheme } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        vi.mocked(repository.load).mockResolvedValue(changed);
        replaceTheme();
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(tree().getByText('M').closest('button')?.textContent).toContain('22/20'));
    });

    it('не заменяет локальный ввод до подтверждения очереди', async () => {
        let release = () => undefined as void;
        const { repository, replaceTheme } = setup(
            typographyStyles(),
            (_c, _t, change) =>
                new Promise((resolve) => {
                    release = () => resolve(updated(bodyM('screen-l', { sizePx: change.size ?? 16 })));
                }),
        );
        await screen.findByText('Body / M', { selector: TITLE });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        replaceTheme();
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
        expect(repository.load).toHaveBeenCalledTimes(1);
        expect(tree().getByText('M').closest('button')?.textContent).toContain('18/20');
        release();
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
    });

    it('в режиме просмотра поля недоступны, а дерево и экраны работают', async () => {
        const { repository } = setup(typographyStyles({ canEdit: false }));
        await screen.findByText('Body / M', { selector: TITLE });
        expect(screen.getByText('Только просмотр')).toBeTruthy();
        expect((inspector().getByLabelText('Size') as HTMLInputElement).disabled).toBe(true);
        expect((inspector().getByLabelText('Семейство шрифта') as HTMLButtonElement).disabled).toBe(true);
        expect((inspector().getByLabelText('Weight Regular') as HTMLButtonElement).disabled).toBe(true);
        // В режиме просмотра ничего нельзя менять, в том числе начертание.
        expect((inspector().getByLabelText('Начертание') as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(inspector().getByLabelText('Начертание'));
        expect(inspector().queryByRole('listbox', { name: 'Начертание' })).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'Мелкие' }));
        fireEvent.click(tree().getByText('M'));
        expect(screen.getByText('Body / M', { selector: TITLE })).toBeTruthy();
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('при уходе с экрана сразу отправляет несохранённые правки', async () => {
        const { repository, unmount } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        unmount();
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0][2]).toEqual({ size: 18 });
    });

    it('опубликованную версию читает по versionId и показывает только для чтения', async () => {
        const historical = { ...context, versionId: 'version-1' };
        const { repository } = mount(typographyStyles({ canEdit: false }), { context: historical, readOnly: true });
        await screen.findByText('Body / M', { selector: TITLE });
        expect(vi.mocked(repository.load).mock.calls[0][0]).toEqual(historical);
        expect(screen.getByText('Только просмотр')).toBeTruthy();
        expect((inspector().getByLabelText('Size') as HTMLInputElement).disabled).toBe(true);
        expect(repository.update).not.toHaveBeenCalled();
        expect(getDraftAutosaveStatus(historical)).toBe('saved');
    });

    it('не показывает баннер прежнего черновика: записи отправляет общее автосохранение', async () => {
        localStorage.setItem(
            'ds_draft:base:0.1.0',
            JSON.stringify({
                'screen-l.body.m.normal': { type: 'typography', enabled: true, values: { web: { fontSize: '1rem' } } },
            }),
        );
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        expect(screen.queryByTestId('typography-legacy-draft')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Отбросить' })).toBeNull();
        expect(Object.keys(JSON.parse(localStorage.getItem('ds_draft:base:0.1.0') ?? '{}'))).toEqual([
            'screen-l.body.m.normal',
        ]);
    });

    it('открывает стиль по tokenId из журнала и сохраняет выбор в адресе', async () => {
        mount(typographyStyles(), { route: '/?tokenId=id:screen-s.body.m.bold&versionId=v1' });
        await waitFor(() =>
            expect(screen.getByRole('tab', { name: 'Мелкие' }).getAttribute('aria-selected')).toBe('true'),
        );
        expect(screen.getByText('Body / M', { selector: TITLE })).toBeTruthy();
        expect(tree().getByText('M').closest('button')?.textContent).toContain('14/20');
        fireEvent.click(screen.getByRole('tab', { name: 'Крупные' }));
        fireEvent.click(tree().getByText('H1'));
        await waitFor(() =>
            expect(screen.getByTestId('location').textContent).toContain('tokenId=id%3Ascreen-l.header.h1.normal'),
        );
        expect(screen.getByTestId('location').textContent).toContain('versionId=v1');
        expect(screen.getByText('Header / H1', { selector: TITLE })).toBeTruthy();
    });

    it('сообщает, что токен вне стилей темы недоступен как источник', async () => {
        mount(typographyStyles(), { route: '/?tokenId=id:text.default.primary' });
        expect(await screen.findByText('Точный источник токена недоступен.')).toBeTruthy();
        expect(screen.getByText('Body / M', { selector: TITLE })).toBeTruthy();
    });
    it('набирает образец шрифтом стиля: образец помечен `data-preview` и не попадает под Inter оболочки', async () => {
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        const sample = document.querySelector(
            '.typography-board-row.is-selected .typography-visible-sample',
        ) as HTMLElement;
        expect(sample.hasAttribute('data-preview')).toBe(true);
        expect(sample.style.fontFamily).toBe('"SB Sans Text", sans-serif');
    });

    it('называет дерево «Типографика» и показывает ненастроенные группы', async () => {
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        expect(document.querySelector('.tw-tree-header-title')?.textContent).toBe('Типографика');
        // В теме фикстуры нет Display и Text: строка «Не настроено» в дереве и на борде.
        expect(screen.getAllByText('Не настроено в текущей теме')).toHaveLength(4);
        expect(groupHeading('Display').getAttribute('aria-expanded')).toBe('true');
    });

    it('показывает результат поиска плоским списком и пустой результат по Figma', async () => {
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        fireEvent.change(screen.getByLabelText('Найти токен'), { target: { value: 'body' } });
        expect(document.querySelectorAll('.typography-tree-body .typography-group-heading')).toHaveLength(0);
        expect(tree().getByText('M')).toBeTruthy();
        // Ввод в поиск не меняет выбранный стиль.
        expect(screen.getByText('Body / M', { selector: TITLE })).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Найти токен'), { target: { value: 'нет такого' } });
        expect(tree().getByRole('status').textContent).toBe(SEARCH_EMPTY_TEXT);
    });

    it('сообщает о пустом разделе без «ничего не найдено»', async () => {
        setup(typographyStyles({ screens: [] }));
        expect(await screen.findByText('В теме пока нет стилей типографии')).toBeTruthy();
        expect(screen.queryByText(SEARCH_EMPTY_TEXT)).toBeNull();
    });

    it('предупреждает о высоте строки меньше размера и сохраняет значение', async () => {
        const { repository } = setup();
        await screen.findByText('Body / M', { selector: TITLE });
        const lineHeight = inspector().getByLabelText('Line Height');
        fireEvent.change(lineHeight, { target: { value: '14' } });
        fireEvent.blur(lineHeight);
        expect(inspector().getByRole('status').textContent).toBe('Высота строки меньше размера шрифта.');
        expect(lineHeight.closest('.typography-field')?.classList.contains('is-warning')).toBe(true);
        expect(inspector().queryByRole('alert')).toBeNull();
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0][2]).toEqual({ lineHeight: 14 });
    });

    it('показывает «+» своего значения всегда кнопкой-иконкой', async () => {
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        inspector()
            .getAllByRole('button', { name: 'Своё значение платформы' })
            .forEach((button) => expect(button.classList.contains('tw-icon-button')).toBe(true));
    });

    it('меняет описание стиля во всех его токенах и показывает экран в описании', async () => {
        const { repository, setDescription } = mount(typographyStyles(), { description: 'Основной текст' });
        await screen.findByText('Body / M', { selector: TITLE });
        const head = document.querySelector('.typography-inspector-head') as HTMLElement;
        expect(head.style.getPropertyValue('--ty-screen-prefix')).toBe('"Крупные экраны · "');
        fireEvent.doubleClick(inspector().getByRole('button', { name: 'Описание токена' }));
        const field = inspector().getByRole('textbox', { name: 'Описание токена' });
        fireEvent.change(field, { target: { value: 'Текст абзацев' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        await waitFor(() => expect(repository.describe).toHaveBeenCalledTimes(9));
        expect(vi.mocked(repository.describe).mock.calls.map((call) => call[1])).toContain('screen-s.body.m.bold');
        expect(vi.mocked(repository.describe).mock.calls.every((call) => call[2] === 'Текст абзацев')).toBe(true);
        await waitFor(() =>
            expect(inspector().getByRole('button', { name: 'Описание токена' }).textContent).toBe('Текст абзацев'),
        );
        expect(setDescription).toHaveBeenCalledWith('Текст абзацев');
    });

    it('без описания токена показывает образец текста, в режиме просмотра описание не меняется', async () => {
        setup(typographyStyles({ canEdit: false }));
        await screen.findByText('Body / M', { selector: TITLE });
        expect(inspector().getByText('Съешь ещё этих мягких французских булок')).toBeTruthy();
        expect(inspector().queryByRole('button', { name: 'Описание токена' })).toBeNull();
    });

    it('сбрасывает изменения стиля: кнопка доступна только у изменённого стиля', async () => {
        mount(typographyStyles());
        await screen.findByText('Body / M', { selector: TITLE });
        expect(
            (inspector().getByRole('button', { name: 'Сбросить изменения токена' }) as HTMLButtonElement).disabled,
        ).toBe(true);
        cleanup();
        mount(typographyStyles(), { changedTokenNames: new Set(['screen-l.body.m.normal']) });
        await screen.findByText('Body / M', { selector: TITLE });
        fireEvent.click(inspector().getByRole('button', { name: 'Сбросить изменения токена' }));
        expect(tokenReset.reset).toHaveBeenCalledTimes(1);
        // У стиля одно описание на всех экранах, поэтому сброс берёт токены стиля на всех экранах.
        const ids = [...tokenReset.reset.mock.calls[0][0]] as string[];
        expect(ids.every((id) => /^screen-[a-z]+\.body\.m\./.test(id))).toBe(true);
        expect(new Set(ids.map((id) => id.split('.')[0])).size).toBeGreaterThan(1);
    });

    it('в режиме просмотра кнопки сброса нет', async () => {
        mount(typographyStyles({ canEdit: false }));
        await screen.findByText('Body / M', { selector: TITLE });
        expect(inspector().queryByRole('button', { name: 'Сбросить изменения токена' })).toBeNull();
    });

    it('открывает список семейств с прокруткой к выбранному', async () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        setup();
        await screen.findByText('Body / M', { selector: TITLE });
        fireEvent.click(inspector().getByLabelText('Семейство шрифта'));
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
        expect(scrollIntoView.mock.contexts[0]).toBe(inspector().getByRole('option', { selected: true }));
        delete (Element.prototype as Partial<Element>).scrollIntoView;
    });

    it('показывает загрузку скелетонами и ошибку загрузки без текста исключения с «Повторить»', async () => {
        let fail = true;
        let resolve = () => undefined as void;
        const { repository } = mount(typographyStyles(), {
            load: () =>
                new Promise((done, reject) => {
                    resolve = () =>
                        fail
                            ? reject(new TypeError("Cannot read properties of undefined (reading 'flatMap')"))
                            : done(typographyStyles());
                }),
        });
        expect(document.querySelector('[data-skeleton="workspace"]')).toBeTruthy();
        expect(document.querySelector('[data-skeleton="tree"]')).toBeTruthy();
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(1));
        resolve();
        expect(await screen.findByText('Не удалось загрузить типографику')).toBeTruthy();
        expect(screen.getByText('Проверьте подключение и попробуйте ещё раз.')).toBeTruthy();
        expect(screen.queryByText(/flatMap/)).toBeNull();
        fail = false;
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
        resolve();
        expect(await screen.findByText('Body / M', { selector: TITLE })).toBeTruthy();
        expect(screen.queryByText('Не удалось загрузить типографику')).toBeNull();
    });
});

it('повторное открытие типографики не кеширует ошибку чтения', async () => {
    const view = setup();
    await waitFor(() => expect(view.repository.load).toHaveBeenCalledOnce());
    vi.mocked(view.repository.load).mockRejectedValueOnce(new Error('temporary typography failure'));
    act(() => notifyEditorDataInvalidated(context, new Set(['theme-tokens'])));
    await waitFor(() => expect(view.repository.load).toHaveBeenCalledTimes(2));
    await act(async () => {});
    await act(async () => view.unmount());
    view.remount();
    await waitFor(() => expect(view.repository.load).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.queryByText('temporary typography failure')).not.toBeInTheDocument());
});
