import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const session = vi.hoisted(() => ({ authenticated: true, reset: () => {} }));
vi.mock('../api', () => ({
    authService: {
        isAuthenticated: () => session.authenticated,
        onSessionReset: (reset: () => void) => {
            session.reset = reset;
            return () => {};
        },
    },
}));
vi.mock('./consent', async (original) => {
    const actual = await original<typeof import('./consent')>();
    return {
        ...actual,
        analyticsConsentEnabled: true,
        getConsentStorageKey: () => 'lifecycle',
        analyticsConsent: actual.createAnalyticsConsent(localStorage, 'lifecycle', (...args) => fetch(...args)),
    };
});
vi.mock('./metrica', async (original) => {
    const actual = await original<typeof import('./metrica')>();
    return { ...actual, webAnalytics: actual.createWebAnalytics({ enabled: true, counterId: 123, baseUrl: '/' }) };
});
import { analyticsConsent } from './consent';
import { webAnalytics } from './metrica';
import { AnalyticsConsent, AnalyticsConsentSettings } from './AnalyticsConsent';
import { AnalyticsNavigation } from './AnalyticsNavigation';

const policy = { version: 'web-v1', sha256: 'a'.repeat(64), text: 'Уведомление для проверки' };
const response = (allowed = false, revision = 0) => ({
    policy,
    current: { revision, analytics_allowed: allowed, receipt: null },
    receipt: {
        revision,
        decision: 'granted',
        policy_version: policy.version,
        policy_sha256: policy.sha256,
        received_at: '2026-11-18T00:00:00Z',
    },
});
const ok = (body: unknown) => new Response(JSON.stringify(body));
const scripts = () => document.querySelectorAll('script[data-dsbuilder-analytics]');
const request = vi.fn();
beforeEach(() => {
    localStorage.clear();
    analyticsConsent.stop();
    webAnalytics.setConsent(false);
    session.authenticated = true;
    request.mockReset();
    vi.stubGlobal('fetch', request);
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

it('shares startup between the settings section and boundary without duplicate GET or banner', async () => {
    request.mockResolvedValue(ok(response()));
    render(
        <MemoryRouter initialEntries={['/settings']}>
            <AnalyticsConsent>
                <AnalyticsConsentSettings />
            </AnalyticsConsent>
        </MemoryRouter>,
    );
    expect(await screen.findByText(policy.text)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Аналитика DS Builder' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Аналитика' })).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);
    expect(scripts()).toHaveLength(0);
});

it('revokes permission through the settings switch', async () => {
    let finish!: (response: Response) => void;
    localStorage.setItem('lifecycle', JSON.stringify({ key: 'b'.repeat(64), revision: 1, decision: 'granted' }));
    request.mockResolvedValueOnce(ok(response(true, 1))).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    render(
        <MemoryRouter initialEntries={['/settings']}>
            <AnalyticsConsent>
                <AnalyticsConsentSettings />
            </AnalyticsConsent>
        </MemoryRouter>,
    );
    await screen.findByText(policy.text);
    await vi.waitFor(() => expect(screen.getByRole('switch', { name: 'Аналитика' })).toBeChecked());
    fireEvent.click(screen.getByRole('switch', { name: 'Аналитика' }));
    expect(screen.getByRole('switch', { name: 'Аналитика' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('switch', { name: 'Аналитика' })).not.toBeChecked();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(JSON.parse(request.mock.calls[1][1].body).decision).toBe('withdrawn');
    await act(async () => {
        finish(ok(response(false, 1)));
    });
    expect(analyticsConsent.getSnapshot().allowed).toBe(false);
    expect(scripts()).toHaveLength(0);
});

it('blocks a late granted POST after logout and checks the preserved choice on next login', async () => {
    let finish!: (response: Response) => void;
    request
        .mockResolvedValueOnce(ok(response()))
        .mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        )
        .mockResolvedValue(ok(response(true, 1)));
    const tree = (
        <MemoryRouter initialEntries={['/projects']}>
            <AnalyticsConsent>
                <AnalyticsNavigation />
            </AnalyticsConsent>
        </MemoryRouter>
    );
    const mounted = render(tree);
    await screen.findByText(policy.text);
    fireEvent.click(screen.getByRole('button', { name: 'Разрешить', exact: true }));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    act(() => {
        session.authenticated = false;
        session.reset();
    });
    mounted.unmount();
    await act(async () => {
        finish(ok(response(true, 1)));
    });
    expect(analyticsConsent.getSnapshot().allowed).toBe(false);
    expect(scripts()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('lifecycle')!).decision).toBe('granted');
    session.authenticated = true;
    render(tree);
    await vi.waitFor(() => expect(scripts()).toHaveLength(1));
    const lateScript = scripts()[0];
    act(() => {
        session.authenticated = false;
        session.reset();
    });
    expect(scripts()).toHaveLength(0);
    const ym = vi.fn();
    window.ym = ym;
    lateScript.dispatchEvent(new Event('load'));
    expect(ym).not.toHaveBeenCalled();
    delete window.ym;
});

it('turns a failed grant off and retries the same grant instead of withdrawing on the next click', async () => {
    request
        .mockResolvedValueOnce(ok(response()))
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(ok(response(true, 1)));
    render(
        <MemoryRouter initialEntries={['/settings']}>
            <AnalyticsConsent>
                <AnalyticsConsentSettings />
            </AnalyticsConsent>
        </MemoryRouter>,
    );
    await screen.findByText(policy.text);
    const toggle = screen.getByRole('switch', { name: 'Аналитика' });
    fireEvent.click(toggle);
    await screen.findByText('Не удалось подтвердить выбор. Аналитика отключена.');
    await vi.waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();
    expect(analyticsConsent.getSnapshot()).toMatchObject({ choice: 'granted', allowed: false, error: true });
    fireEvent.click(toggle);
    await vi.waitFor(() => expect(toggle).toBeEnabled());
    await vi.waitFor(() => expect(toggle).toBeChecked());
    const first = JSON.parse(request.mock.calls[1][1].body);
    const retry = JSON.parse(request.mock.calls[2][1].body);
    expect(first.decision).toBe('granted');
    expect(retry).toEqual(first);
});

it('does not enable a saved grant until the startup GET confirms it', async () => {
    localStorage.setItem('lifecycle', JSON.stringify({ key: 'b'.repeat(64), revision: 1, decision: 'granted' }));
    let finish!: (response: Response) => void;
    request.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    render(
        <MemoryRouter initialEntries={['/settings']}>
            <AnalyticsConsent>
                <AnalyticsConsentSettings />
            </AnalyticsConsent>
        </MemoryRouter>,
    );
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(analyticsConsent.getSnapshot().choice).toBe('granted');
    expect(screen.getByRole('switch', { name: 'Аналитика' })).not.toBeChecked();
    await act(async () => {
        finish(ok(response(true, 1)));
    });
    expect(screen.getByRole('switch', { name: 'Аналитика' })).toBeChecked();
    expect(request).toHaveBeenCalledOnce();
});
