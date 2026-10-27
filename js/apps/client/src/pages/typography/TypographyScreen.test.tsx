import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesignSystem, Theme } from '../../controllers';
import { getDraftAutosaveStatus } from '../../api/draftAutosaveActivity';
import {
    TypographyOperationError,
    type TypographyContext,
    type TypographyStyleRepository,
    type TypographyStyles,
} from '../../modules/typographyTokens';
import { bodyM, typographyStyles, updated } from '../../modules/typographyTokens/testFixtures';
import { TypographyScreen } from './TypographyScreen';
import { setTypographyStyleRepository } from './useTypographyEditor';

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
}

const setup = (styles: TypographyStyles = typographyStyles(), update?: TypographyStyleRepository['update']) =>
    mount(styles, { update });

const mount = (styles: TypographyStyles, options: MountOptions = {}) => {
    const parameters = { readOnly: options.readOnly ?? false } as Record<string, unknown>;
    const setValue = vi.fn();
    const designSystem = {
        getName: () => 'base',
        getParameters: () => parameters,
    } as unknown as DesignSystem;
    const createTheme = () =>
        ({
            getName: () => 'base_default',
            getToken: () => ({ setValue }),
        }) as unknown as Theme;
    const repository: TypographyStyleRepository = {
        load: vi.fn(async () => styles),
        update: vi.fn(
            options.update ??
                (async (_c, tokenId, change) => {
                    const screenId = tokenId.split('.')[0] as 'screen-l';
                    return updated(bodyM(screenId, { sizePx: change.size ?? 16 }));
                }),
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
    const replaceTheme = () => result.rerender(view(createTheme()));
    return { repository, setValue, rerender, unmount: result.unmount, replaceTheme };
};

const tree = () => within(document.querySelector('.token-tree') as HTMLElement);
const groupHeading = (label: string) =>
    tree().getByText(label, { selector: '.token-tree-heading span' }).closest('button') as HTMLButtonElement;
const inspector = () => within(document.querySelector('.properties-panel') as HTMLElement);

describe('экран «Типографика»', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('помечает изменённый стиль в дереве', async () => {
        mount(typographyStyles(), { changedTokenNames: new Set(['screen-l.body.m.bold']) });
        expect(await screen.findByRole('heading', { name: 'Body / Body M' })).toBeTruthy();
        const row = tree().getByRole('button', { name: /Body M/ });
        expect(within(row).getByLabelText('Есть изменения')).toBeTruthy();
    });

    it('открывается на «Крупных» с выбранным Body M: дерево, борд и инспектор', async () => {
        setup();
        expect(await screen.findByRole('heading', { name: 'Body / Body M' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Крупные' }).getAttribute('aria-selected')).toBe('true');
        expect(tree().getByText('Body M').closest('button')?.textContent).toContain('16/20');
        expect(tree().getByText('H1')).toBeTruthy();
        const row = screen.getByRole('button', { name: 'Body M, 16 px, 20 px line' });
        expect(row.textContent).toContain('Съешь ещё этих мягких французских булок');
        expect(row.textContent).toContain('строка 20 px');
        expect(row.textContent).toContain('W 400·500·600');
        expect(inspector().getByText('Темы').textContent).toContain('2');
        expect(inspector().getByText('СПИСОК КОМПОНЕНТОВ · 11 ЭКЗЕМПЛЯРОВ')).toBeTruthy();
    });

    it('переключает экран, сохраняет выбор и возвращается к Body M, если стиля нет', async () => {
        setup();
        await screen.findByRole('heading', { name: 'Body / Body M' });
        fireEvent.click(tree().getByText('H1'));
        expect(screen.getByRole('heading', { name: 'Header / H1' })).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Средние' }));
        expect(screen.getByRole('heading', { name: 'Header / H1' })).toBeTruthy();
        expect(tree().getByText('H1').closest('button')?.textContent).toContain('40/44');
        fireEvent.click(screen.getByRole('tab', { name: 'Мелкие' }));
        expect(screen.getByRole('heading', { name: 'Body / Body M' })).toBeTruthy();
        expect(tree().getByText('Body M').closest('button')?.textContent).toContain('14/20');
    });

    it('ищет и сворачивает группы', async () => {
        setup();
        await screen.findByRole('heading', { name: 'Body / Body M' });
        fireEvent.click(groupHeading('Body'));
        expect(tree().queryByText('Body M')).toBeNull();
        fireEvent.click(groupHeading('Body'));
        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        fireEvent.change(screen.getByLabelText('Найти токен'), { target: { value: 'h1' } });
        expect(tree().queryByText('Body M')).toBeNull();
        expect(tree().getByText('H1')).toBeTruthy();
    });

    it('сохраняет размер выбранного экрана с базовыми редакциями значений стиля и обновляет модель темы', async () => {
        const { repository, setValue, rerender } = setup();
        await screen.findByRole('heading', { name: 'Body / Body M' });
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
        expect(setValue).toHaveBeenCalledWith('web', { fontSize: '1.125rem' });
        expect(rerender).toHaveBeenCalled();
        expect(tree().getByText('Body M').closest('button')?.textContent).toContain('18/20');
    });

    it('выбирает семейство из семейств дизайн-системы и меняет вес начертания', async () => {
        const { repository } = setup();
        await screen.findByRole('heading', { name: 'Body / Body M' });
        fireEvent.click(inspector().getByLabelText('Семейство шрифта'));
        const options = within(inspector().getByRole('listbox', { name: 'Семейства' })).getAllByRole('option');
        expect(options.map((option) => option.textContent)).toEqual(['Display SB Sans Display', 'Body SB Sans Text']);
        fireEvent.click(options[0]);
        fireEvent.click(inspector().getByLabelText('Начертание'));
        const variants = within(inspector().getByRole('listbox', { name: 'Начертание' })).getAllByRole('option');
        expect(variants.map((option) => option.textContent)).toEqual(['Regular', 'Medium', 'Bold']);
        expect(inspector().getByLabelText('Weight Regular').textContent).toBe('400 / Regular');
        fireEvent.click(variants[2]);
        expect(inspector().queryByRole('listbox', { name: 'Начертание' })).toBeNull();
        expect(inspector().getByLabelText('Weight Bold').textContent).toBe('600 / SemiBold');
        // Образцы борда рисуются весом выбранного начертания.
        const sample = document.querySelector(
            '.typography-canvas-row.is-selected .typography-visible-sample',
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
        expect((inspector().getByLabelText('Line Height Android') as HTMLInputElement).value).toBe('22');
        fireEvent.click(inspector().getByRole('button', { name: 'Убрать своё значение Android' }));
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0][2]).toEqual({ platform: 'android', lineHeight: 20 });
        expect(inspector().queryByLabelText('Line Height Android')).toBeNull();
    });

    it('показывает ошибку значения у поля и не отправляет его', async () => {
        const { repository } = setup();
        await screen.findByRole('heading', { name: 'Body / Body M' });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '-5' } });
        fireEvent.blur(size);
        expect(inspector().getByRole('alert').textContent).toBe(
            'Размер и межстрочный интервал должны быть положительными числами.',
        );
        expect(tree().getByText('Body M').closest('button')?.textContent).toContain('16/20');
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
        vi.mocked(repository.load).mockResolvedValue(changed);
        replaceTheme();
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(tree().getByText('Body M').closest('button')?.textContent).toContain('22/20'));
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        replaceTheme();
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
        expect(repository.load).toHaveBeenCalledTimes(1);
        expect(tree().getByText('Body M').closest('button')?.textContent).toContain('18/20');
        release();
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
    });

    it('в режиме просмотра поля недоступны, а дерево и экраны работают', async () => {
        const { repository } = setup(typographyStyles({ canEdit: false }));
        await screen.findByRole('heading', { name: 'Body / Body M' });
        expect(screen.getByText('Только просмотр')).toBeTruthy();
        expect((inspector().getByLabelText('Size') as HTMLInputElement).disabled).toBe(true);
        expect((inspector().getByLabelText('Семейство шрифта') as HTMLButtonElement).disabled).toBe(true);
        expect((inspector().getByLabelText('Weight Regular') as HTMLButtonElement).disabled).toBe(true);
        // В режиме просмотра ничего нельзя менять, в том числе начертание.
        expect((inspector().getByLabelText('Начертание') as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(inspector().getByLabelText('Начертание'));
        expect(inspector().queryByRole('listbox', { name: 'Начертание' })).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'Мелкие' }));
        fireEvent.click(tree().getByText('Body M'));
        expect(screen.getByRole('heading', { name: 'Body / Body M' })).toBeTruthy();
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('при уходе с экрана сразу отправляет несохранённые правки', async () => {
        const { repository, unmount } = setup();
        await screen.findByRole('heading', { name: 'Body / Body M' });
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
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
        await screen.findByRole('heading', { name: 'Body / Body M' });
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
        expect(screen.getByRole('heading', { name: 'Body / Body M' })).toBeTruthy();
        expect(tree().getByText('Body M').closest('button')?.textContent).toContain('14/20');
        fireEvent.click(screen.getByRole('tab', { name: 'Крупные' }));
        fireEvent.click(tree().getByText('H1'));
        await waitFor(() =>
            expect(screen.getByTestId('location').textContent).toContain('tokenId=id%3Ascreen-l.header.h1.normal'),
        );
        expect(screen.getByTestId('location').textContent).toContain('versionId=v1');
        expect(screen.getByRole('heading', { name: 'Header / H1' })).toBeTruthy();
    });

    it('сообщает, что токен вне стилей темы недоступен как источник', async () => {
        mount(typographyStyles(), { route: '/?tokenId=id:text.default.primary' });
        expect(await screen.findByText('Точный источник токена недоступен.')).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Body / Body M' })).toBeTruthy();
    });
});
