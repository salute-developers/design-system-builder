import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Root } from '../Main.styles.ts';
import { StyledFormColumn, StyledPreviewColumn, Wrapper } from './Login.styles.ts';

import { ActionButton } from '../../components';
import { AuthState, BrandPreview, LoginForm } from '../../features';
import { authService, REQUEST_ACCESS_URL } from '../../api';
import { fetchOwnerProjectId } from '../../hooks';

export type LoginReason = 'expired';

const Login = () => {
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const reason = searchParams.get('reason') as LoginReason | null;

    const onSubmit = async ({ login, password }: { login: string; password: string }) => {
        setError(undefined);
        setLoading(true);

        try {
            await authService.login(login, password);
        } catch {
            setError('Неверный логин или пароль');
            setLoading(false);
            return;
        }

        try {
            const ownerProjectId = await fetchOwnerProjectId();

            if (!ownerProjectId) {
                setError('У пользователя нет проектов');
                return;
            }

            navigate(`/${ownerProjectId}`);
        } catch {
            setError('Не удалось загрузить проекты');
        } finally {
            setLoading(false);
        }
    };

    const onRequestAccess = () => {
        window.open(REQUEST_ACCESS_URL, '_blank', 'noopener,noreferrer');
    };

    const onResetReason = () => {
        setSearchParams({}, { replace: true });
    };

    const renderContent = () => {
        if (reason === 'expired') {
            return (
                <AuthState
                    eyebrow="Безопасность"
                    title="Сессия завершена"
                    description="Время сессии истекло. Войдите снова, чтобы вернуться в Builder."
                    actions={
                        <>
                            <ActionButton text="Войти снова" view="primary" stretched onClick={onResetReason} />
                            <ActionButton text="Сменить аккаунт" view="secondary" stretched onClick={onResetReason} />
                        </>
                    }
                />
            );
        }

        return <LoginForm error={error} loading={loading} onSubmit={onSubmit} onRequestAccess={onRequestAccess} />;
    };

    return (
        <Root grayTone="warmGray" themeMode="dark">
            <Wrapper>
                <StyledPreviewColumn>
                    <BrandPreview />
                </StyledPreviewColumn>
                <StyledFormColumn>{renderContent()}</StyledFormColumn>
            </Wrapper>
        </Root>
    );
};

export { Login };
