import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import type { TenantTokenValueDto } from '../../api/editorContracts';
import { tokenRepository } from '../../api/tokenRepository';
import { themesApi } from '../../modules/themes/data/themesApi';
import type { ThemeTenant } from '../../modules/themes/domain/theme';
import { resetQueryCache } from '../../shared/data/useLoad';
import { OtherThemesSection, cssPx, webValue } from './OtherThemesSection';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 'light' };

const theme = (id: string, name: string) => ({ id, name }) as ThemeTenant;

const value = (tenantId: string, mode: 'light' | 'dark', hex: string): TenantTokenValueDto =>
    ({
        id: `${tenantId}-${mode}`,
        tokenId: 't1',
        tenantId,
        platform: 'web',
        mode,
        value: [hex],
    }) as TenantTokenValueDto;

const values = (tenantId: string, light: string, dark: string): [string, TenantTokenValueDto[]] => [
    tenantId,
    [value(tenantId, 'light', light), value(tenantId, 'dark', dark)],
];

const Location = () => {
    const location = useLocation();
    return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const describeRow = (items: TenantTokenValueDto[]) => [
    String((webValue(items, 't1', 'light') as string[] | undefined)?.[0] ?? ''),
    String((webValue(items, 't1', 'dark') as string[] | undefined)?.[0] ?? ''),
];

const tree = () => (
    <MemoryRouter initialEntries={['/projects/p/design-systems/ds/themes/light/colors?versionId=v1']}>
        <Routes>
            <Route
                path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId/colors"
                element={
                    <>
                        <OtherThemesSection
                            context={{ ...context, versionId: 'v1' }}
                            tokenIds={['t1']}
                            addressTokenId="t1"
                            columns={['Light', 'Dark']}
                            describe={describeRow}
                        />
                        <Location />
                    </>
                }
            />
        </Routes>
    </MemoryRouter>
);

const renderSection = () => render(tree());

beforeEach(() => {
    vi.restoreAllMocks();
    resetQueryCache();
    localStorage.clear();
    vi.spyOn(themesApi, 'list').mockResolvedValue([
        theme('light', 'Light'),
        theme('dark', 'Dark'),
        theme('kids', 'Kids'),
    ]);
});
afterEach(cleanup);

describe('OtherThemesSection', () => {
    it('свёрнут по умолчанию и не грузит значения, пока его не раскрыли', async () => {
        const load = vi.spyOn(tokenRepository, 'loadValuesByTenant');
        renderSection();

        const toggle = await screen.findByRole('button', { name: 'В других темах · 2' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(load).not.toHaveBeenCalled();
    });

    it('раскрытие делает один запрос и показывает значения без отметок отличия', async () => {
        const load = vi
            .spyOn(tokenRepository, 'loadValuesByTenant')
            .mockResolvedValue(
                new Map([
                    values('dark', '#222222', '#EEEEEE'),
                    values('kids', '#111111', '#EEEEEE'),
                    values('light', '#111111', '#EEEEEE'),
                ]),
            );
        renderSection();

        fireEvent.click(await screen.findByRole('button', { name: 'В других темах · 2' }));
        const table = await screen.findByRole('table', { name: 'Значения в других темах' });
        expect(load).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledWith(expect.objectContaining({ versionId: 'v1' }), ['t1'], expect.anything());
        expect(themesApi.list).toHaveBeenCalledWith('p', 'ds', expect.anything(), 'v1');
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((row) => row.textContent)).toEqual(['Dark#222222#EEEEEE', 'Kids#111111#EEEEEE']);
        expect(screen.queryByText('≠')).not.toBeInTheDocument();
        expect(localStorage.getItem('dsb.inspector.other-themes.open')).toBe('true');
    });

    it('поиск по темам открывается кнопкой, когда других тем больше порога', async () => {
        const many = Array.from({ length: 9 }, (_, index) =>
            theme(index ? `t${index}` : 'light', index ? `Тема ${index}` : 'Light'),
        );
        vi.spyOn(themesApi, 'list').mockResolvedValue(many);
        vi.spyOn(tokenRepository, 'loadValuesByTenant').mockResolvedValue(new Map());
        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: 'В других темах · 8' }));
        await screen.findByRole('table', { name: 'Значения в других темах' });
        expect(screen.queryByRole('textbox', { name: 'Найти тему в других темах' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Поиск' }));
        const search = screen.getByRole('textbox', { name: 'Найти тему в других темах' });
        fireEvent.change(search, { target: { value: 'тема 3' } });
        expect(
            screen
                .getAllByRole('row')
                .slice(1)
                .map((row) => row.textContent),
        ).toEqual(['Тема 3']);

        fireEvent.keyDown(search, { key: 'Escape' });
        expect(screen.queryByRole('textbox', { name: 'Найти тему в других темах' })).not.toBeInTheDocument();
        expect(screen.getAllByRole('row')).toHaveLength(9);
    });

    it('строка открывает ту же секцию другой темы на этом токене', async () => {
        vi.spyOn(tokenRepository, 'loadValuesByTenant').mockResolvedValue(
            new Map([values('dark', '#111111', '#EEEEEE'), values('kids', '#111111', '#EEEEEE')]),
        );
        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: 'В других темах · 2' }));
        fireEvent.click(await screen.findByRole('row', { name: /Kids/ }));

        await waitFor(() =>
            expect(screen.getByTestId('location')).toHaveTextContent(
                '/projects/p/design-systems/ds/themes/kids/colors?versionId=v1&tokenId=t1',
            ),
        );
    });

    it('ошибка загрузки предлагает повторить запрос', async () => {
        const load = vi
            .spyOn(tokenRepository, 'loadValuesByTenant')
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValue(new Map([values('dark', '#111111', '#EEEEEE'), values('kids', '#111111', '#EEEEEE')]));
        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: 'В других темах · 2' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить значения других тем.');
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(await screen.findByText('Kids')).toBeInTheDocument();
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('не показывается, если других тем нет', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('light', 'Light')]);
        const view = renderSection();
        await waitFor(() => expect(themesApi.list).toHaveBeenCalled());
        expect(view.container.querySelector('.other-themes')).toBeNull();
    });
});

describe('cssPx', () => {
    it('переводит rem и px в пиксели', () => {
        expect(cssPx('2rem')).toBe(32);
        expect(cssPx('1.875rem')).toBe(30);
        expect(cssPx('12px')).toBe(12);
        expect(cssPx(8)).toBe(8);
        expect(cssPx('auto')).toBeNull();
    });
});
