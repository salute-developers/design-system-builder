import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const fixture = vi.hoisted(() => ({
    state: {
        allowed: false,
        choice: undefined as string | undefined,
        busy: false,
        saving: undefined as string | undefined,
        error: false,
        policy: { version: 'web-v1', sha256: 'a'.repeat(64), text: 'Короткое уведомление о Яндекс Метрике' } as
            | { version: string; sha256: string; text: string }
            | undefined,
    },
    choose: vi.fn(),
    start: vi.fn(),
    review: vi.fn(),
    setConsent: vi.fn(),
    stop: vi.fn(),
}));
vi.mock('../api', () => ({ authService: { isAuthenticated: () => true, onSessionReset: () => () => {} } }));
vi.mock('./consent', () => ({
    analyticsConsentEnabled: true,
    consentStorageKey: 'test',
    analyticsConsent: {
        subscribe: () => () => {},
        getSnapshot: () => fixture.state,
        start: fixture.start,
        choose: fixture.choose,
        review: fixture.review,
        changed: vi.fn(),
        stop: fixture.stop,
    },
}));
vi.mock('./metrica', () => ({ webAnalytics: { setConsent: fixture.setConsent } }));
import { AnalyticsConsent, AnalyticsConsentSettings } from './AnalyticsConsent';
const renderBanner = () =>
    render(
        <MemoryRouter>
            <AnalyticsConsent />
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.clearAllMocks();
    fixture.start.mockResolvedValue(undefined);
    fixture.state = {
        allowed: false,
        choice: undefined,
        busy: false,
        saving: undefined as string | undefined,
        error: false,
        policy: { version: 'web-v1', sha256: 'a'.repeat(64), text: 'Короткое уведомление о Яндекс Метрике' },
    };
});
afterEach(cleanup);

it('shows the entire short notice and two accessible buttons without blocking the page', () => {
    renderBanner();
    expect(screen.getByText('Короткое уведомление о Яндекс Метрике')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Отказаться' }));
    expect(fixture.choose).toHaveBeenCalledWith('denied');
    expect(fixture.setConsent).toHaveBeenCalledWith(false);
});

it('keeps withdrawal available while a grant request is still pending', () => {
    fixture.state = { ...fixture.state, choice: 'granted', busy: true, saving: 'granted' };
    renderBanner();
    expect(screen.getByRole('button', { name: 'Сохраняем разрешение…', exact: true })).toBeDisabled();
    const withdraw = screen.getByRole('button', { name: 'Отозвать разрешение' });
    expect(withdraw).toBeEnabled();
    fireEvent.click(withdraw);
    expect(fixture.choose).toHaveBeenCalledWith('withdrawn');
});

it('does not leave a floating settings button after a remembered denial', () => {
    fixture.state = { ...fixture.state, choice: 'denied' };
    renderBanner();
    expect(screen.queryByRole('button')).toBeNull();
});

it('hides the automatic banner on notice failure', () => {
    fixture.state = { ...fixture.state, policy: undefined, error: true };
    renderBanner();
    expect(screen.queryByRole('heading', { name: 'Аналитика DS Builder' })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
});

it('loads the notice through the user settings section', async () => {
    fixture.state = { ...fixture.state, choice: 'denied' };
    render(<AnalyticsConsentSettings />);
    await vi.waitFor(() => expect(fixture.review).toHaveBeenCalledOnce());
    expect(screen.getByRole('switch', { name: 'Аналитика' })).toBeEnabled();
});

it.each(['/settings', '/settings/', '/SETTINGS/'])('does not duplicate the banner on %s', (pathname) => {
    render(
        <MemoryRouter initialEntries={[pathname]}>
            <AnalyticsConsent>
                <AnalyticsConsentSettings />
            </AnalyticsConsent>
        </MemoryRouter>,
    );
    expect(screen.queryByRole('heading', { name: 'Аналитика DS Builder' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Аналитика' })).toBeVisible();
});

it('shows saving on the rejection rather than grant in the banner', () => {
    fixture.state = { ...fixture.state, choice: 'denied', busy: true, saving: 'denied' };
    renderBanner();
    expect(screen.getByRole('button', { name: 'Разрешить', exact: true })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Сохраняем отказ…' })).toHaveAttribute('aria-busy', 'true');
});

it('disables the switch and shows adjacent circular progress while grant is saving', () => {
    fixture.state = { ...fixture.state, choice: 'granted', busy: true, saving: 'granted' };
    render(<AnalyticsConsentSettings />);
    const toggle = screen.getByRole('switch', { name: 'Аналитика' });
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status', { name: 'Сохраняем выбор' })).toBeVisible();
    fireEvent.click(toggle);
    expect(fixture.choose).not.toHaveBeenCalled();
});

it('uses buttons that cannot submit the enclosing form', () => {
    const submit = vi.fn();
    render(
        <form onSubmit={submit}>
            <AnalyticsConsentSettings />
        </form>,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Аналитика' }));
    expect(fixture.choose).toHaveBeenCalledWith('granted');
    expect(submit).not.toHaveBeenCalled();
});

it.each(['granted', 'denied', 'withdrawn'])('keeps the banner and error visible when saving %s fails', (choice) => {
    fixture.state = { ...fixture.state, choice, error: true };
    renderBanner();
    expect(screen.getByRole('heading', { name: 'Аналитика DS Builder' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Не удалось подтвердить выбор');
    expect(screen.getByRole('button', { name: 'Разрешить', exact: true })).toBeEnabled();
    expect(fixture.setConsent).toHaveBeenCalledWith(false);
});

it('does not show a saving indicator while only loading a notice for a remembered denial', () => {
    fixture.state = { ...fixture.state, choice: 'denied', busy: true, policy: undefined };
    render(<AnalyticsConsentSettings />);
    expect(screen.getByRole('switch', { name: 'Аналитика' })).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByText('Сохраняем отказ…')).toBeNull();
});
