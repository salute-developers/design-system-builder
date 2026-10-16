import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('./Components', () => ({ Components: () => <div>Редактор компонентов</div> }));

import { ComponentsRoute } from './ComponentsRoute';

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/themes/:tenantId">
                    <Route path="colors" element={<div>Цветовые токены</div>} />
                    <Route path="components/:componentName?" element={<ComponentsRoute />} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

describe('ComponentsRoute', () => {
    afterEach(() => {
        cleanup();
        vi.unstubAllEnvs();
    });

    it('opens the component editor when the section is enabled', () => {
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'true');

        renderAt('/themes/theme-1/components/Button');

        expect(screen.getByText('Редактор компонентов')).toBeInTheDocument();
    });

    it.each(['/themes/theme-1/components', '/themes/theme-1/components/Button', '/themes/theme-1/components/compose-Avatar'])(
        'redirects %s to the colors section when the section is disabled',
        (path) => {
            vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'false');

            renderAt(path);

            expect(screen.getByText('Цветовые токены')).toBeInTheDocument();
            expect(screen.queryByText('Редактор компонентов')).not.toBeInTheDocument();
        },
    );
});
