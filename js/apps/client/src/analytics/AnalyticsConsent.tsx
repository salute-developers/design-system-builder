import type { ReactNode } from 'react';
import { useEffect, useSyncExternalStore } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { authService } from '../api';
import { analyticsConsent, analyticsConsentEnabled, getConsentStorageKey } from './consent';
import { webAnalytics } from './metrica';

const Panel = styled.section`
    position: fixed;
    z-index: 10000;
    bottom: 1.25rem;
    right: 1.25rem;
    width: min(32rem, calc(100vw - 2.5rem));
    box-sizing: border-box;
    max-height: calc(100dvh - 2.5rem);
    overflow-y: auto;
    padding: 1.25rem;
    border-radius: 0.625rem;
    border: 1px solid var(--outline-transparent-primary);
    background: var(--surface-general-card);
    color: var(--text-primary);
    box-shadow: var(--shadow-center-hard-m);
    h2 {
        margin: 0 0 0.625rem;
        font-size: 1rem;
        line-height: 1.5;
    }
    p {
        margin: 0 0 1rem;
        color: var(--text-secondary);
        font-size: 0.875rem;
        line-height: 1.5;
    }
`;
const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    && button.ps-button-neutral {
        background: var(--surface-transparent-secondary);
        color: var(--text-primary);
    }
    && button.ps-button-neutral:hover:not(:disabled) {
        background: var(--surface-transparent-secondary);
        opacity: 0.85;
    }
`;

const SettingRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    width: 100%;
    box-sizing: border-box;
    padding: 1rem 0;
    border-bottom: 1px solid var(--outline-transparent-primary);
    .analytics-setting-description {
        flex: 1;
        min-width: 0;
    }
    .analytics-setting-label {
        display: block;
        color: var(--text-primary);
        font-size: 0.875rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
    }
    p {
        margin: 0;
        color: var(--text-secondary);
    }
    p[role='status'] {
        margin-top: 0.5rem;
    }
    .analytics-setting-controls {
        display: flex;
        align-items: center;
        flex: 0 0 auto;
        gap: 0.75rem;
    }
    .analytics-setting-progress {
        width: 1rem;
        height: 1rem;
        box-sizing: border-box;
        border: 2px solid var(--outline-transparent-primary);
        border-top-color: var(--surface-accent-primary);
        border-radius: 50%;
        animation: analytics-setting-spin 0.8s linear infinite;
    }
    .analytics-setting-progress[data-saving='false'] {
        visibility: hidden;
        animation-play-state: paused;
    }
    @keyframes analytics-setting-spin {
        to {
            transform: rotate(360deg);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .analytics-setting-progress {
            animation: none;
        }
    }
    && button[role='switch'],
    && button[role='switch']:hover:not(:disabled) {
        flex: 0 0 2rem;
        width: 2rem;
        height: 1.25rem;
        padding: 0.125rem;
        border: 0;
        border-radius: 1rem;
        background: var(--surface-transparent-secondary);
        cursor: pointer;
        transition: background 150ms;
    }
    && button[role='switch'][aria-checked='true'],
    && button[role='switch'][aria-checked='true']:hover:not(:disabled) {
        background: var(--surface-accent-primary);
    }
    button[role='switch']::after {
        content: '';
        display: block;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        background: var(--on-dark-text-primary);
        transition: transform 150ms;
    }
    button[role='switch'][aria-checked='true']::after {
        transform: translateX(0.75rem);
    }
    button[role='switch']:focus-visible {
        outline: 2px solid var(--text-primary);
        outline-offset: 3px;
    }
`;

const useConsent = () => useSyncExternalStore(analyticsConsent.subscribe, analyticsConsent.getSnapshot);

/** Общие действия баннера и настроек: ожидание относится только к выбранному решению. */
const ConsentContent = () => {
    const state = useConsent();
    const granting = state.saving === 'granted';
    const rejecting = ['denied', 'withdrawn'].includes(state.saving ?? '');
    const rejection = state.choice === 'granted' ? 'withdrawn' : 'denied';
    const labels = {
        denied: 'Сохраняем отказ…',
        withdrawn: 'Отзываем разрешение…',
    };
    return (
        <>
            <h2 id="analytics-consent-title">Аналитика DS Builder</h2>
            <p>{state.policy?.text || 'До вашего разрешения аналитика отключена.'}</p>
            <p>Текущий выбор: {state.allowed ? 'разрешена' : 'отключена'}.</p>
            {state.error && <p role="status">Не удалось подтвердить выбор. Аналитика отключена.</p>}
            <Actions>
                <button
                    type="button"
                    className="ps-button ps-button-primary"
                    disabled={!state.policy || Boolean(state.saving)}
                    aria-busy={granting}
                    onClick={() => void analyticsConsent.choose('granted')}
                >
                    {granting ? 'Сохраняем разрешение…' : 'Разрешить'}
                </button>
                <button
                    type="button"
                    className="ps-button ps-button-neutral"
                    disabled={rejecting}
                    aria-busy={rejecting}
                    onClick={() => void analyticsConsent.choose(rejection)}
                >
                    {rejecting
                        ? labels[state.saving as keyof typeof labels]
                        : rejection === 'withdrawn'
                          ? 'Отозвать разрешение'
                          : 'Отказаться'}
                </button>
            </Actions>
        </>
    );
};

export const AnalyticsConsentSettings = ({ active = true }: { active?: boolean }) => {
    const state = useConsent();
    const checked = state.allowed || state.saving === 'granted';
    useEffect(() => {
        if (active) void analyticsConsent.review();
    }, [active]);
    return (
        <SettingRow>
            <div className="analytics-setting-description">
                <span id="analytics-setting-label" className="analytics-setting-label">
                    Аналитика
                </span>
                <p id="analytics-setting-notice">{state.policy?.text || 'До вашего разрешения аналитика отключена.'}</p>
                {state.error && <p role="status">Не удалось подтвердить выбор. Аналитика отключена.</p>}
            </div>
            <span className="analytics-setting-controls">
                <span
                    className="analytics-setting-progress"
                    data-saving={Boolean(state.saving)}
                    aria-hidden={!state.saving}
                    role={state.saving ? 'status' : undefined}
                    aria-label="Сохраняем выбор"
                />
                <button
                    type="button"
                    role="switch"
                    aria-labelledby="analytics-setting-label"
                    aria-describedby="analytics-setting-notice"
                    aria-checked={checked}
                    aria-busy={Boolean(state.saving)}
                    disabled={Boolean(state.saving) || (!state.policy && !checked)}
                    onClick={() => void analyticsConsent.choose(checked ? 'withdrawn' : 'granted')}
                />
            </span>
        </SettingRow>
    );
};

/** Монтируется только внутри авторизованной части маршрутов. */
export const AnalyticsConsent = ({ children }: { children?: ReactNode }) => {
    const state = useConsent();
    const { pathname } = useLocation();
    useEffect(() => {
        if (!analyticsConsentEnabled) return;
        let scope = getConsentStorageKey();
        const update = () =>
            webAnalytics.setConsent(
                scope === getConsentStorageKey() &&
                    authService.isAuthenticated() &&
                    analyticsConsent.getSnapshot().allowed,
            );
        const unsubscribe = analyticsConsent.subscribe(update);
        update();
        const reset = () => {
            analyticsConsent.stop();
            webAnalytics.setConsent(false);
        };
        const unsubscribeSession = authService.onSessionReset(reset);
        void analyticsConsent.start();
        const listener = (event: StorageEvent) => {
            const nextScope = authService.isAuthenticated() ? getConsentStorageKey() : undefined;
            if (scope !== nextScope) {
                scope = nextScope;
                reset();
                if (scope) void analyticsConsent.start();
            } else if ([scope, null].includes(event.key)) analyticsConsent.changed();
        };
        window.addEventListener('storage', listener);
        return () => {
            unsubscribe();
            unsubscribeSession();
            window.removeEventListener('storage', listener);
            reset();
        };
    }, []);
    const visible =
        analyticsConsentEnabled &&
        !matchPath('/settings', pathname) &&
        state.policy &&
        (!state.choice || state.busy || state.error);
    return (
        <>
            {visible && (
                <Panel aria-labelledby="analytics-consent-title" aria-live="polite">
                    <ConsentContent />
                </Panel>
            )}
            {children}
        </>
    );
};
