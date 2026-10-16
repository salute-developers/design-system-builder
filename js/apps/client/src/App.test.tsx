import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Outlet } from 'react-router-dom';

vi.mock('./pages', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./pages')>()),
    Main: () => <Outlet />,
    Colors: () => <div>Раздел цветов</div>,
}));

import App from './App';
import { authService } from './api';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
});

describe('App routes', () => {
    it('opens the colors of a Theme by the old overview link', async () => {
        vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);
        window.history.pushState({}, '', '/projects/project-1/design-systems/ds-1/themes/theme-1/overview');

        render(<App />);

        expect(await screen.findByText('Раздел цветов')).toBeInTheDocument();
        expect(window.location.pathname).toBe('/projects/project-1/design-systems/ds-1/themes/theme-1/colors');
    });
});
