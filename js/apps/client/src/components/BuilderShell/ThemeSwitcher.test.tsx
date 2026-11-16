import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import * as autosave from '../../api/draftAutosaveActivity';
import { themesApi } from '../../modules/themes/data/themesApi';
import type { ThemeTenant } from '../../modules/themes/domain/theme';
import { resetQueryCache } from '../../shared/data/useLoad';
import { THEME_SEARCH_THRESHOLD, THEME_SWITCH_BLOCKED, ThemeSwitcher, themeSwitchPath } from './ThemeSwitcher';

const theme = (id: string, name: string): ThemeTenant => ({
    id,
    designSystemId: 'ds',
    name,
    editRevision: 1,
    colorConfig: { profile: 'malachite' },
    preview: {
        accentLight: '#00aa55',
        onAccentLight: '#ffffff',
        surfaceLight: '#ffffff',
        accentDark: '#00cc66',
        surfaceDark: '#111111',
    },
});

const Location = () => {
    const location = useLocation();
    return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderAt = (path: string, canCreate = true) => {
    const versionId = new URLSearchParams(path.split('?')[1]).get('versionId') ?? undefined;
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/projects/:projectId/design-systems/:designSystemId/themes/:tenantId/*"
                    element={
                        <>
                            <ThemeSwitcher
                                context={{ projectId: 'p', designSystemId: 'ds', tenantId: 'light', versionId }}
                                currentName="Light brand"
                                canCreate={canCreate}
                            />
                            <Location />
                        </>
                    }
                />
            </Routes>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    vi.restoreAllMocks();
    resetQueryCache();
});
afterEach(cleanup);

describe('ThemeSwitcher', () => {
    it('открывает ту же секцию другой темы с versionId и tokenId', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('light', 'Light brand'), theme('dark', 'Dark brand')]);
        renderAt('/projects/p/design-systems/ds/themes/light/shapes?versionId=v1&tokenId=t1');

        fireEvent.click(screen.getByRole('button', { name: 'Тема Light brand. Переключить тему' }));
        const list = await screen.findByRole('listbox', { name: 'Темы' });
        expect(within(list).getByRole('option', { name: /Light brand/ })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(within(list).getByRole('option', { name: /Dark brand/ }));

        await waitFor(() =>
            expect(screen.getByTestId('location')).toHaveTextContent(
                '/projects/p/design-systems/ds/themes/dark/shapes?versionId=v1&tokenId=t1',
            ),
        );
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(themesApi.list).toHaveBeenCalledWith('p', 'ds', expect.anything(), 'v1');
    });

    it('не уходит из темы, пока автосохранение черновика не закончилось', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('light', 'Light brand'), theme('dark', 'Dark brand')]);
        vi.spyOn(autosave, 'waitForDraftAutosaveIdle').mockRejectedValue(new Error('busy'));
        renderAt('/projects/p/design-systems/ds/themes/light/colors?tokenId=t1');

        fireEvent.click(screen.getByRole('button', { name: /Переключить тему/ }));
        fireEvent.click(within(await screen.findByRole('listbox', { name: 'Темы' })).getByRole('option', { name: /Dark/ }));

        expect(await screen.findByText(THEME_SWITCH_BLOCKED)).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent('/projects/p/design-systems/ds/themes/light/colors?tokenId=t1');
    });

    it('выбирает тему стрелками и Enter, Escape закрывает список', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('light', 'Light brand'), theme('dark', 'Dark brand')]);
        renderAt('/projects/p/design-systems/ds/themes/light/colors');
        const trigger = screen.getByRole('button', { name: /Переключить тему/ });

        fireEvent.click(trigger);
        const list = await screen.findByRole('listbox', { name: 'Темы' });
        fireEvent.keyDown(list, { key: 'Escape' });
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        const reopened = await screen.findByRole('listbox', { name: 'Темы' });
        fireEvent.keyDown(reopened, { key: 'ArrowDown' });
        fireEvent.keyDown(reopened, { key: 'Enter' });

        await waitFor(() =>
            expect(screen.getByTestId('location')).toHaveTextContent('/projects/p/design-systems/ds/themes/dark/colors'),
        );
    });

    it('принимает стрелки и Enter, пока фокус ещё на кнопке крошки', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('light', 'Light brand'), theme('dark', 'Dark brand')]);
        renderAt('/projects/p/design-systems/ds/themes/light/colors');
        const trigger = screen.getByRole('button', { name: /Переключить тему/ });

        fireEvent.click(trigger);
        await screen.findByRole('listbox', { name: 'Темы' });
        fireEvent.keyDown(trigger, { key: 'ArrowDown' });
        fireEvent.keyDown(trigger, { key: 'Enter' });

        await waitFor(() =>
            expect(screen.getByTestId('location')).toHaveTextContent('/projects/p/design-systems/ds/themes/dark/colors'),
        );
    });

    it('показывает поиск, когда тем больше порога', async () => {
        const many = Array.from({ length: THEME_SEARCH_THRESHOLD + 1 }, (_, index) =>
            theme(index === 0 ? 'light' : `t${index}`, index === 0 ? 'Light brand' : `Тема ${index}`),
        );
        vi.spyOn(themesApi, 'list').mockResolvedValue(many);
        renderAt('/projects/p/design-systems/ds/themes/light/colors');

        fireEvent.click(screen.getByRole('button', { name: /Переключить тему/ }));
        const search = await screen.findByRole('searchbox', { name: 'Найти тему' });
        await waitFor(() => expect(search).toHaveFocus());
        fireEvent.change(search, { target: { value: '  тема   3 ' } });

        const options = await screen.findAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('Тема 3');
    });

    it('без поиска для небольшого списка и без создания без права', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('light', 'Light brand')]);
        renderAt('/projects/p/design-systems/ds/themes/light/colors', false);

        fireEvent.click(screen.getByRole('button', { name: /Переключить тему/ }));
        await screen.findByRole('option', { name: /Light brand/ });
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Создать тему' })).not.toBeInTheDocument();
    });

    it('предлагает создать тему из текущей', async () => {
        vi.spyOn(themesApi, 'list').mockResolvedValue([theme('light', 'Light brand')]);
        renderAt('/projects/p/design-systems/ds/themes/light/colors');

        fireEvent.click(screen.getByRole('button', { name: /Переключить тему/ }));
        expect(await screen.findByRole('link', { name: 'Создать тему' })).toHaveAttribute(
            'href',
            '/projects/p/design-systems/ds/themes/new?from=light',
        );
    });
});

describe('themeSwitchPath', () => {
    it('меняет только сегмент темы', () => {
        expect(
            themeSwitchPath('/projects/p/design-systems/ds/themes/light/components/Button', 'light', 'dark'),
        ).toBe('/projects/p/design-systems/ds/themes/dark/components/Button');
    });
});
