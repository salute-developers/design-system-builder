import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DesignSystem, Theme } from '../../controllers';
import {
    TypographyOperationError,
    type TypographyStyleRepository,
    type TypographyStyles,
} from '../../modules/typographyTokens';
import { bodyM, typographyStyles, updated } from '../../modules/typographyTokens/testFixtures';
import { TypographyScreen } from './TypographyScreen';
import { setTypographyStyleRepository } from './useTypographyEditor';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };

const setup = (styles: TypographyStyles = typographyStyles(), update?: TypographyStyleRepository['update']) => {
    const view = mount(styles, update);
    return view;
};

const mount = (styles: TypographyStyles, update?: TypographyStyleRepository['update']) => {
    const parameters = { editRevision: 3, readOnly: false } as Record<string, unknown>;
    const setValue = vi.fn();
    const designSystem = {
        getName: () => 'base',
        getParameters: () => parameters,
    } as unknown as DesignSystem;
    const theme = {
        getName: () => 'base_default',
        getToken: () => ({ setValue }),
    } as unknown as Theme;
    const repository: TypographyStyleRepository = {
        load: vi.fn(async () => styles),
        update: vi.fn(
            update ??
                (async (_c, tokenId, change, editRevision) => {
                    const screenId = tokenId.split('.')[0] as 'screen-l';
                    return updated(bodyM(screenId, { sizePx: change.size ?? 16 }), editRevision + 1);
                }),
        ),
    };
    setTypographyStyleRepository(repository);
    const rerender = vi.fn();
    const { unmount } = render(
        <MemoryRouter>
            <TypographyScreen context={context} designSystem={designSystem} theme={theme} rerender={rerender} />
        </MemoryRouter>,
    );
    return { repository, parameters, setValue, rerender, unmount };
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

    it('сохраняет размер выбранного экрана и обновляет модель темы', async () => {
        const { repository, parameters, setValue, rerender } = setup();
        await screen.findByRole('heading', { name: 'Body / Body M' });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        expect(screen.getByTestId('typography-save-status').textContent).toContain('Сохранение…');
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0].slice(1)).toEqual([
            'screen-l.body.m.normal',
            { size: 18 },
            3,
        ]);
        await waitFor(() => expect(screen.getByTestId('typography-save-status').textContent).toContain('Сохранено'));
        expect(parameters.editRevision).toBe(4);
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
        const variant = inspector().getByLabelText('Начертание') as HTMLSelectElement;
        expect([...variant.options].map((option) => option.textContent)).toEqual(['Regular', 'Medium', 'Bold']);
        expect((inspector().getByLabelText('Weight Regular') as HTMLSelectElement).value).toBe('400');
        fireEvent.change(variant, { target: { value: 'bold' } });
        expect((inspector().getByLabelText('Weight Bold') as HTMLSelectElement).value).toBe('600');
        fireEvent.change(inspector().getByLabelText('Weight Bold'), { target: { value: '700' } });
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
        expect(vi.mocked(repository.update).mock.calls[0][2]).toEqual({
            fontFamily: 'display',
            weights: { bold: 700 },
        });
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

    it('при ошибке сети оставляет значение и предлагает повторить', async () => {
        let fail = true;
        const { repository } = setup(typographyStyles(), async (_c, tokenId, change, editRevision) => {
            if (fail) throw new TypographyOperationError('network', 'Сервис недоступен, изменения не сохранены');
            return updated(bodyM('screen-l', { sizePx: change.size ?? 16 }), editRevision + 1);
        });
        await screen.findByRole('heading', { name: 'Body / Body M' });
        const size = inspector().getByLabelText('Size') as HTMLInputElement;
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        const status = screen.getByTestId('typography-save-status');
        await waitFor(() => expect(status.textContent).toContain('Не сохранено'));
        expect(size.value).toBe('18');
        fail = false;
        fireEvent.click(within(status).getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(status.textContent).toContain('Сохранено'));
        expect(repository.update).toHaveBeenCalledTimes(2);
    });

    it('при конфликте перезагружает стили и ждёт «Повторить»', async () => {
        let conflict = true;
        const { repository } = setup(typographyStyles(), async (_c, _tokenId, change, editRevision) => {
            if (conflict) throw new TypographyOperationError('conflict', 'Конфликт', 'TENANT_EDIT_CONFLICT', null, 9);
            return updated(bodyM('screen-l', { sizePx: change.size ?? 16 }), editRevision + 1);
        });
        await screen.findByRole('heading', { name: 'Body / Body M' });
        const size = inspector().getByLabelText('Size');
        fireEvent.change(size, { target: { value: '18' } });
        fireEvent.blur(size);
        await waitFor(() =>
            expect(screen.getByTestId('typography-save-status').textContent).toContain('Тема изменена в другом месте'),
        );
        await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
        expect(repository.update).toHaveBeenCalledTimes(1);
        conflict = false;
        fireEvent.click(
            within(screen.getByTestId('typography-save-status')).getByRole('button', { name: 'Повторить' }),
        );
        await waitFor(() => expect(screen.getByTestId('typography-save-status').textContent).toContain('Сохранено'));
        expect(repository.update).toHaveBeenCalledTimes(2);
    });

    it('в режиме просмотра поля недоступны, а дерево и экраны работают', async () => {
        const { repository } = setup(typographyStyles({ canEdit: false }));
        await screen.findByRole('heading', { name: 'Body / Body M' });
        expect(screen.getByText('Read-only access')).toBeTruthy();
        expect((inspector().getByLabelText('Size') as HTMLInputElement).disabled).toBe(true);
        expect((inspector().getByLabelText('Семейство шрифта') as HTMLButtonElement).disabled).toBe(true);
        expect((inspector().getByLabelText('Weight Regular') as HTMLSelectElement).disabled).toBe(true);
        expect((inspector().getByLabelText('Начертание') as HTMLSelectElement).disabled).toBe(false);
        fireEvent.click(screen.getByRole('tab', { name: 'Мелкие' }));
        fireEvent.click(tree().getByText('Body M'));
        expect(screen.getByRole('heading', { name: 'Body / Body M' })).toBeTruthy();
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('сохраняет записи прежнего черновика и удаляет из него только сохранённые', async () => {
        localStorage.setItem(
            'ds_draft:base:0.1.0',
            JSON.stringify({
                'screen-l.body.m.normal': {
                    type: 'typography',
                    enabled: true,
                    values: { web: { fontSize: '1.125rem', lineHeight: '1.5rem', fontWeight: '400' } },
                },
                'screen-m.header.h1.bold': {
                    type: 'typography',
                    enabled: true,
                    values: { web: { fontSize: '2.75rem', fontWeight: '700' } },
                },
                'light.text.default.primary': { type: 'color', enabled: true, values: { web: '#000' } },
            }),
        );
        const { repository } = setup(typographyStyles(), async (_c, tokenId, change, editRevision) => {
            if (tokenId.startsWith('screen-m')) throw new TypographyOperationError('network', 'Сервис недоступен');
            return updated(bodyM('screen-l', { sizePx: change.size ?? 16 }), editRevision + 1);
        });
        const banner = await screen.findByTestId('typography-legacy-draft');
        expect(banner.textContent).toContain('2');
        fireEvent.click(within(banner).getByRole('button', { name: 'Сохранить' }));
        await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(2));
        await screen.findByText(/Не удалось сохранить черновик/);
        const draft = JSON.parse(localStorage.getItem('ds_draft:base:0.1.0') ?? '{}');
        expect(Object.keys(draft).sort()).toEqual(['light.text.default.primary', 'screen-m.header.h1.bold']);
        expect(screen.getByTestId('typography-legacy-draft').textContent).toContain('1');
        fireEvent.click(
            within(screen.getByTestId('typography-legacy-draft')).getByRole('button', { name: 'Отбросить' }),
        );
        expect(Object.keys(JSON.parse(localStorage.getItem('ds_draft:base:0.1.0') ?? '{}'))).toEqual([
            'light.text.default.primary',
        ]);
        expect(screen.queryByTestId('typography-legacy-draft')).toBeNull();
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

    it('после конфликта при сохранении черновика перечитывает ревизию и сохраняет повторно', async () => {
        localStorage.setItem(
            'ds_draft:base:0.1.0',
            JSON.stringify({
                'screen-l.body.m.normal': {
                    type: 'typography',
                    enabled: true,
                    values: { web: { fontSize: '1.125rem', fontWeight: '400' } },
                },
            }),
        );
        let conflict = true;
        const { repository, parameters } = setup(
            typographyStyles({ editRevision: 5 }),
            async (_c, _t, change, editRevision) => {
                if (conflict)
                    throw new TypographyOperationError('conflict', 'Конфликт', 'TENANT_EDIT_CONFLICT', null, 5);
                return updated(bodyM('screen-l', { sizePx: change.size ?? 16 }), editRevision + 1);
            },
        );
        const banner = await screen.findByTestId('typography-legacy-draft');
        parameters.editRevision = 4;
        fireEvent.click(within(banner).getByRole('button', { name: 'Сохранить' }));
        await screen.findByText(/Не удалось сохранить черновик/);
        await waitFor(() => expect(parameters.editRevision).toBe(5));
        conflict = false;
        fireEvent.click(
            within(screen.getByTestId('typography-legacy-draft')).getByRole('button', { name: 'Сохранить' }),
        );
        await screen.findByText('Правки из черновика сохранены.');
        expect(vi.mocked(repository.update).mock.calls[1][3]).toBe(5);
        expect(screen.queryByTestId('typography-legacy-draft')).toBeNull();
    });

    it('позволяет отбросить записи черновика, которые не относятся к стилям темы', async () => {
        localStorage.setItem(
            'ds_draft:base:0.1.0',
            JSON.stringify({
                'screen-l.body.custom.normal': { type: 'typography', enabled: true, values: { web: {} } },
            }),
        );
        setup();
        const banner = await screen.findByTestId('typography-legacy-draft');
        expect(banner.textContent).toContain('1');
        fireEvent.click(within(banner).getByRole('button', { name: 'Отбросить' }));
        expect(JSON.parse(localStorage.getItem('ds_draft:base:0.1.0') ?? '{}')).toEqual({});
        expect(screen.queryByTestId('typography-legacy-draft')).toBeNull();
    });
});
