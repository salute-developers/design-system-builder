import { useEffect, useMemo, useState } from 'react';

import { createDsBuilderApi, type DsBuilderApi } from './api/dsBuilderApi';
import { createHttpClient } from './api/httpClient';
import { TransportError, type AuthEndpoints, type TokenPair } from './auth/authEndpoints';
import { Session } from './auth/session';
import type { PluginBridge } from './bridge';
import { Browser } from './screens/Browser';
import { LoginScreen } from './screens/LoginScreen';

type AppState = 'restoring' | 'signed-out' | 'signed-in' | 'unavailable';

const defaultApi = (session: Session) => createDsBuilderApi(createHttpClient(session));

const failureText = (error: unknown) => {
    if (error instanceof TransportError) return 'Сервер DS Builder недоступен.';
    return `Не удалось открыть сохранённую сессию: ${error instanceof Error ? error.message : String(error)}`;
};

/** Корень окна: восстановление сессии, вход и просмотр. */
export const App = ({
    bridge,
    endpoints,
    createApi = defaultApi,
}: {
    bridge: PluginBridge;
    endpoints: AuthEndpoints;
    createApi?: (session: Session) => DsBuilderApi;
}) => {
    const session = useMemo(() => new Session(bridge, endpoints), [bridge, endpoints]);
    const api = useMemo(() => createApi(session), [createApi, session]);
    const [state, setState] = useState<AppState>('restoring');
    const [attempt, setAttempt] = useState(0);
    const [failure, setFailure] = useState('');

    const fail = (error: unknown) => {
        setFailure(failureText(error));
        setState('unavailable');
    };

    useEffect(() => session.onExpired(() => setState('signed-out')), [session]);

    useEffect(() => {
        setState('restoring');
        session.restore().then((restored) => setState(restored ? 'signed-in' : 'signed-out'), fail);
    }, [session, attempt]);

    const signedIn = (tokens: TokenPair) => {
        session.signIn(tokens).then(
            () => setState('signed-in'),
            () => {
                // Токен некуда сохранить: офлайн-сессия на сервере осталась бы без владельца.
                void endpoints.logout(tokens.refreshToken).catch(() => undefined);
                setFailure('Не удалось сохранить вход. Попробуйте войти снова.');
                setState('unavailable');
            },
        );
    };

    /** Экран входа не ждёт ответа сервера: токены очищаются сразу, а запрос выхода завершается в фоне. */
    const signOut = () => {
        void session.signOut();
        setState('signed-out');
    };

    if (state === 'restoring')
        return (
            <p className="status" role="status">
                Загружаем…
            </p>
        );
    if (state === 'unavailable')
        return (
            <div className="status" role="alert">
                <p>{failure}</p>
                <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                    Повторить
                </button>
            </div>
        );
    if (state === 'signed-out')
        return <LoginScreen endpoints={endpoints} openExternal={bridge.openExternal} onSignedIn={signedIn} />;
    return <Browser api={api} storage={bridge} onSignOut={signOut} />;
};
