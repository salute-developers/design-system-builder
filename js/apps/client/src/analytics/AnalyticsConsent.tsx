import { useEffect, useState, useSyncExternalStore } from 'react';
import styled from 'styled-components';

import { analyticsConsent, analyticsConsentEnabled, consentStorageKey } from './consent';
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
`;
const Button = styled.button<{ $primary?: boolean }>`
    font: inherit;
    font-size: 0.875rem;
    border: 0;
    border-radius: 0.375rem;
    padding: 0.625rem 0.875rem;
    cursor: pointer;
    color: var(--text-primary);
    background: ${({ $primary }) =>
        $primary ? 'var(--surface-accent-primary)' : 'var(--surface-transparent-secondary)'};
    &:hover {
        opacity: 0.85;
    }
    &:focus-visible {
        outline: 2px solid var(--text-primary);
        outline-offset: 3px;
    }
    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;
const SettingsButton = styled(Button)`
    position: fixed;
    z-index: 9999;
    right: 1.25rem;
    bottom: 1rem;
    background: var(--surface-general-card);
    box-shadow: var(--shadow-center-hard-m);
`;

/** Неблокирующее уведомление доступно на странице входа и в редакторе. */
export const AnalyticsConsent = () => {
    const state = useSyncExternalStore(analyticsConsent.subscribe, analyticsConsent.getSnapshot);
    const [settings, setSettings] = useState(false);
    useEffect(() => {
        if (!analyticsConsentEnabled) return;
        const unsubscribe = analyticsConsent.subscribe(() => {
            webAnalytics.setConsent(analyticsConsent.getSnapshot().allowed);
        });
        void analyticsConsent.start();
        const listener = (event: StorageEvent) => {
            if ([consentStorageKey, null].includes(event.key)) analyticsConsent.changed();
        };
        window.addEventListener('storage', listener);
        return () => {
            unsubscribe();
            window.removeEventListener('storage', listener);
        };
    }, []);
    useEffect(() => {
        webAnalytics.setConsent(state.allowed);
    }, [state.allowed]);
    if (!analyticsConsentEnabled) return null;
    const rejection =
        state.choice === 'granted'
            ? ({ decision: 'withdrawn', label: 'Отозвать разрешение' } as const)
            : ({ decision: 'denied', label: 'Отказаться' } as const);
    const visible = settings || !state.choice || state.busy || (state.error && state.choice === 'granted');
    if (!visible)
        return (
            <SettingsButton
                onClick={() => {
                    setSettings(true);
                    void analyticsConsent.review();
                }}
            >
                Настройки аналитики
            </SettingsButton>
        );
    return (
        <Panel aria-labelledby="analytics-consent-title" aria-live="polite">
            <h2 id="analytics-consent-title">Аналитика DS Builder</h2>
            <p>
                {state.policy?.text ||
                    'Яндекс Метрика помогает понять, какие разделы востребованы. До вашего разрешения аналитика отключена.'}
            </p>
            {state.error && <p role="status">Не удалось подтвердить выбор. Аналитика отключена.</p>}
            <Actions>
                <Button
                    $primary
                    disabled={state.busy || !state.policy}
                    onClick={() => void analyticsConsent.choose('granted')}
                >
                    Разрешить
                </Button>
                <Button onClick={() => void analyticsConsent.choose(rejection.decision)}>{rejection.label}</Button>
                {settings && <Button onClick={() => setSettings(false)}>Закрыть</Button>}
            </Actions>
        </Panel>
    );
};
