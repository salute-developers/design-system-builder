import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreviewEnvironmentBar } from './PreviewEnvironmentBar';

const modes = [
    { label: 'Тёмный', value: 'dark' },
    { label: 'Светлый', value: 'light' },
];

const renderBar = () => {
    const handlers = { onPlatformSelect: vi.fn(), onViewSelect: vi.fn(), onThemeModeSelect: vi.fn() };
    render(
        <PreviewEnvironmentBar
            title="Button M Accent"
            platform="web"
            platforms={[
                { platform: 'web', available: true },
                { platform: 'compose', available: false },
            ]}
            views={['default', 'onDark', 'onLight']}
            view="default"
            themeMode={modes[0]}
            themeModes={modes}
            {...handlers}
        />,
    );
    return handlers;
};

describe('PreviewEnvironmentBar', () => {
    afterEach(cleanup);

    it('shows the combination title and disables a platform without the component', () => {
        const { onPlatformSelect } = renderBar();

        expect(screen.getByRole('heading', { name: 'Button M Accent' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Платформа: Web' }));
        expect(screen.getByRole('menuitemradio', { name: 'Web' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', { name: 'Compose' })).toBeDisabled();
        expect(onPlatformSelect).not.toHaveBeenCalled();
    });

    it('switches the theme and the container view', () => {
        const { onThemeModeSelect, onViewSelect } = renderBar();

        fireEvent.click(screen.getByRole('switch', { name: 'Тёмная тема' }));
        expect(onThemeModeSelect).toHaveBeenCalledWith(modes[1]);

        fireEvent.click(screen.getByRole('button', { name: 'Вид: default' }));
        expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
            'default',
            'onDark',
            'onLight',
        ]);
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'onDark' }));
        expect(onViewSelect).toHaveBeenCalledWith('onDark');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
