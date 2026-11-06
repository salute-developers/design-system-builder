import { useEffect, useRef, useState } from 'react';

import { OAuthError, StorageError, type LoginCode, type PluginCore } from '../core/pluginCore';

type LoginState =
    | { step: 'idle'; error?: string }
    | { step: 'requesting' }
    | { step: 'waiting'; device: LoginCode };

const failureText = (error: unknown) => {
    if (error instanceof OAuthError && error.code === 'expired_token') return 'Время на подтверждение вышло.';
    if (error instanceof OAuthError && error.code === 'access_denied') return 'Вход отклонён в браузере.';
    if (error instanceof OAuthError && error.code === 'not_allowed')
        return 'Вашей учётной записи не разрешён вход в плагин. Обратитесь к администратору.';
    if (error instanceof OAuthError) return 'Не удалось войти. Попробуйте снова.';
    return error instanceof Error ? error.message : String(error);
};

/** Вход в DS Builder: подтверждение во внешнем браузере и опрос выдачи токена. */
export const LoginScreen = ({
    core,
    openExternal,
    onSignedIn,
    onSaveFailed,
}: {
    core: Pick<PluginCore, 'startLogin' | 'completeLogin'>;
    openExternal: (url: string) => void;
    onSignedIn: () => void;
    onSaveFailed: () => void;
}) => {
    const [state, setState] = useState<LoginState>({ step: 'idle' });
    const polling = useRef<AbortController | null>(null);

    useEffect(() => () => polling.current?.abort(), []);

    const signIn = async () => {
        setState({ step: 'requesting' });
        const controller = new AbortController();
        polling.current = controller;
        try {
            const device = await core.startLogin();
            openExternal(device.verificationUri);
            setState({ step: 'waiting', device });
            await core.completeLogin(controller.signal);
            onSignedIn();
        } catch (failure) {
            if (controller.signal.aborted) return;
            if (failure instanceof StorageError) onSaveFailed();
            else setState({ step: 'idle', error: failureText(failure) });
        }
    };

    const cancel = () => {
        polling.current?.abort();
        setState({ step: 'idle' });
    };

    return (
        <main className="login">
            <h1>DS Builder</h1>
            {state.step === 'waiting' ? (
                <>
                    <p>Подтвердите вход в открывшемся браузере. Код должен совпадать:</p>
                    <p className="user-code" data-testid="user-code">
                        {state.device.userCode}
                    </p>
                    <div className="actions">
                        <button type="button" onClick={() => openExternal(state.device.verificationUri)}>
                            Открыть снова
                        </button>
                        <button type="button" className="secondary" onClick={cancel}>
                            Отмена
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <p>Войдите, чтобы увидеть токены дизайн-системы.</p>
                    {state.step === 'idle' && state.error && <p role="alert">{state.error}</p>}
                    <button type="button" disabled={state.step === 'requesting'} onClick={() => void signIn()}>
                        {state.step === 'idle' && state.error ? 'Войти снова' : 'Войти'}
                    </button>
                </>
            )}
        </main>
    );
};
