import { useEffect, useState } from 'react';

import type { PluginBridge } from './bridge';
import { ApiError, type PluginCore } from './core/pluginCore';
import { Browser } from './screens/Browser';
import { LoginScreen } from './screens/LoginScreen';

type AppState = 'restoring' | 'signed-out' | 'signed-in' | 'unavailable';

const failureText = (error: unknown) => {
    if (error instanceof ApiError && error.kind === 'network') return 'Сервер DS Builder недоступен.';
    return `Не удалось открыть сохранённую сессию: ${error instanceof Error ? error.message : String(error)}`;
};

/** Корень окна: восстановление сессии, вход и просмотр. */
export const App = ({ bridge, core }: { bridge: PluginBridge; core: PluginCore }) => {
    const [state, setState] = useState<AppState>('restoring');
    const [attempt, setAttempt] = useState(0);
    const [failure, setFailure] = useState('');

    const fail = (error: unknown) => {
        setFailure(failureText(error));
        setState('unavailable');
    };

    useEffect(() => core.onExpired(() => setState('signed-out')), [core]);

    useEffect(() => {
        setState('restoring');
        core.restore().then((restored) => setState(restored ? 'signed-in' : 'signed-out'), fail);
    }, [core, attempt]);

    const saveFailed = () => {
        setFailure('Не удалось сохранить вход. Попробуйте войти снова.');
        setState('unavailable');
    };

    /** Экран входа не ждёт ответа сервера: токены очищаются сразу, а запрос выхода завершается в фоне. */
    const signOut = () => {
        void core.signOut().catch(() => undefined);
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
        return (
            <LoginScreen
                core={core}
                openExternal={bridge.openExternal}
                onSignedIn={() => setState('signed-in')}
                onSaveFailed={saveFailed}
            />
        );
    return (
        <Browser
            api={core.api}
            storage={bridge}
            applyExport={bridge.applyExport}
            packZip={bridge.packZip}
            onSignOut={signOut}
        />
    );
};
