import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    state: {
        allowed: false,
        choice: undefined as string | undefined,
        busy: false,
        error: false,
        policy: { version: 'web-v1', sha256: 'a'.repeat(64), text: 'Короткое уведомление о Яндекс Метрике' } as
            | { version: string; sha256: string; text: string }
            | undefined,
    },
    choose: vi.fn(),
    start: vi.fn(),
    review: vi.fn(),
    setConsent: vi.fn(),
}));
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
    },
}));
vi.mock('./metrica', () => ({ webAnalytics: { setConsent: fixture.setConsent } }));
import { AnalyticsConsent } from './AnalyticsConsent';

beforeEach(() => {
    vi.clearAllMocks();
    fixture.state = {
        allowed: false,
        choice: undefined,
        busy: false,
        error: false,
        policy: { version: 'web-v1', sha256: 'a'.repeat(64), text: 'Короткое уведомление о Яндекс Метрике' },
    };
});
afterEach(cleanup);

it('shows the entire short notice and two accessible buttons without blocking the page', () => {
    render(<AnalyticsConsent />);
    expect(screen.getByText('Короткое уведомление о Яндекс Метрике')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Отказаться' }));
    expect(fixture.choose).toHaveBeenCalledWith('denied');
    expect(fixture.setConsent).toHaveBeenCalledWith(false);
});

it('keeps withdrawal available while a grant request is still pending', () => {
    fixture.state = { ...fixture.state, choice: 'granted', busy: true };
    render(<AnalyticsConsent />);
    expect(screen.getByRole('button', { name: 'Разрешить', exact: true })).toBeDisabled();
    const withdraw = screen.getByRole('button', { name: 'Отозвать разрешение' });
    expect(withdraw).toBeEnabled();
    fireEvent.click(withdraw);
    expect(fixture.choose).toHaveBeenCalledWith('withdrawn');
});

it('lets a previously declined user open settings and load the short notice explicitly', () => {
    fixture.state = { ...fixture.state, choice: 'denied' };
    render(<AnalyticsConsent />);
    fireEvent.click(screen.getByRole('button', { name: 'Настройки аналитики' }));
    expect(fixture.review).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Разрешить', exact: true })).toBeVisible();
});

it('hides the automatic banner on notice failure and keeps settings available', () => {
    fixture.state = { ...fixture.state, policy: undefined, error: true };
    const { rerender } = render(<AnalyticsConsent />);
    expect(screen.queryByRole('heading', { name: 'Аналитика DS Builder' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Разрешить', exact: true })).toBeNull();
    expect(fixture.setConsent).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Настройки аналитики' }));
    expect(fixture.review).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Разрешить', exact: true })).toBeDisabled();
    fixture.state = {
        ...fixture.state,
        error: false,
        policy: {
            version: 'web-v1',
            sha256: 'a'.repeat(64),
            text: 'Загруженное уведомление',
        },
    };
    rerender(<AnalyticsConsent />);
    expect(screen.getByText('Загруженное уведомление')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Разрешить', exact: true })).toBeEnabled();
    expect(fixture.choose).not.toHaveBeenCalled();
});

it.each(['granted', 'denied', 'withdrawn'])('keeps the banner and error visible when saving %s fails', (choice) => {
    fixture.state = { ...fixture.state, choice, error: true };
    render(<AnalyticsConsent />);
    expect(screen.getByRole('heading', { name: 'Аналитика DS Builder' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Не удалось подтвердить выбор');
    expect(screen.getByRole('button', { name: 'Разрешить', exact: true })).toBeEnabled();
    expect(fixture.setConsent).toHaveBeenCalledWith(false);
});
