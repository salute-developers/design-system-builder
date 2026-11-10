import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWebAnalytics } from './metrica';
import { hasAuthorizationParameters, normalizeAnalyticsView } from './routes';

const config = { enabled: true, counterId: 123, baseUrl: '/dev/design-system-builder/client/' };
const colors = normalizeAnalyticsView('/projects/secret/design-systems/private/themes/tenant/colors')!;
const script = () => document.querySelector<HTMLScriptElement>('script[data-dsbuilder-analytics]')!;

afterEach(() => {
    document.head.innerHTML = '';
    delete window.ym;
});

describe('web analytics', () => {
    it('normalizes only known screens and drops authorization data', () => {
        expect(colors.path).toBe('/projects/:projectId/design-systems/:designSystemId/themes/:tenantId/colors');
        expect(normalizeAnalyticsView('/projects/private/design-systems/id/themes/tenant/components/Secret')).toEqual({
            path: '/projects/:projectId/design-systems/:designSystemId/themes/:tenantId/components/:componentName',
            title: 'Компоненты',
        });
        expect(normalizeAnalyticsView('/legacy/name/1.0.0/colors')).toBeUndefined();
        expect(normalizeAnalyticsView('/projects/p/design-systems/d/themes/t/overview')).toBeUndefined();
        expect(hasAuthorizationParameters('?code=secret&state=state', '')).toBe(true);
        expect(hasAuthorizationParameters('', '#access_token=secret')).toBe(true);
        expect(hasAuthorizationParameters('?filter=private', '#colors')).toBe(false);
    });
    it('loads once, defers initial hit and normalizes referers', () => {
        const analytics = createWebAnalytics(config);
        analytics.view(colors);
        expect(document.querySelectorAll('script[data-dsbuilder-analytics]')).toHaveLength(1);
        expect(script().referrerPolicy).toBe('no-referrer');
        const ym = vi.fn();
        window.ym = ym;
        script().dispatchEvent(new Event('load'));
        analytics.view({ path: '/projects', title: 'Проекты' });
        analytics.view(colors);
        expect(ym.mock.calls.map((call) => call[1])).toEqual(['init', 'hit', 'hit', 'hit']);
        expect(ym.mock.calls[0][2]).toMatchObject({
            defer: true,
            clickmap: false,
            webvisor: false,
            trackLinks: false,
            sendTitle: false,
        });
        const serialized = JSON.stringify(ym.mock.calls);
        expect(serialized).not.toContain('secret');
        expect(serialized).not.toContain('private');
        expect(ym.mock.calls[2][3].referer).toContain('/dev/design-system-builder/client/projects/:projectId');
    });
    it('keeps latest 32 views and stops after a blocked script', () => {
        const analytics = createWebAnalytics(config);
        for (let index = 0; index < 40; index++) analytics.view({ path: '/projects', title: 'Проекты' });
        const ym = vi.fn();
        window.ym = ym;
        script().dispatchEvent(new Event('load'));
        expect(ym).toHaveBeenCalledTimes(33);
        document.head.innerHTML = '';
        const blocked = createWebAnalytics(config);
        blocked.view(colors);
        script().dispatchEvent(new Event('error'));
        blocked.view(colors);
        expect(document.querySelectorAll('script[data-dsbuilder-analytics]')).toHaveLength(1);
        expect(ym).toHaveBeenCalledTimes(33);
    });
    it('does not load without explicit enabling and a positive number', () => {
        for (const options of [
            { ...config, enabled: false },
            { ...config, counterId: 0 },
            { ...config, counterId: NaN },
        ]) {
            createWebAnalytics(options).view(colors);
        }
        expect(script()).toBeNull();
    });
    it('isolates a throwing SDK', () => {
        const analytics = createWebAnalytics(config);
        analytics.view(colors);
        window.ym = () => {
            throw new Error('blocked');
        };
        expect(() => script().dispatchEvent(new Event('load'))).not.toThrow();
        expect(() => analytics.view(colors)).not.toThrow();
    });
});
