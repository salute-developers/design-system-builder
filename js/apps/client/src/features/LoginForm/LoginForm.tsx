import { FormEvent, useState } from 'react';

import { ActionButton, Divider, FormField } from '../../components';
import { Root, StyledActions, StyledFields, StyledHeader, StyledSubtitle, StyledTitle } from './LoginForm.styles';

interface LoginFormProps {
    error?: string;
    loading?: boolean;
    onSubmit: (credentials: { login: string; password: string }) => void;
    onRequestAccess: () => void;
}

export const LoginForm = (props: LoginFormProps) => {
    const { error, loading = false, onSubmit, onRequestAccess } = props;

    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');

    const [localError, setLocalError] = useState<string>();

    const message = localError ?? error;
    const view = message ? 'negative' : 'default';

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) {
            return;
        }

        if (!login.trim() || !password) {
            setLocalError('Введите логин и пароль');
            return;
        }

        setLocalError(undefined);

        onSubmit({ login: login.trim(), password });
    };

    return (
        <Root onSubmit={handleSubmit} noValidate>
            <StyledHeader>
                <StyledTitle>Вход в DS Builder</StyledTitle>
                <StyledSubtitle>Введите логин и пароль, выданные командой SDDS.</StyledSubtitle>
            </StyledHeader>
            <StyledFields>
                <FormField
                    label="Логин"
                    name="username"
                    autoComplete="username"
                    placeholder="Введите логин"
                    value={login}
                    view={view}
                    autoFocus
                    onChange={(event) => setLogin(event.target.value)}
                />
                <FormField
                    label="Пароль"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Введите пароль"
                    value={password}
                    view={view}
                    helperText={message}
                    onChange={(event) => setPassword(event.target.value)}
                />
            </StyledFields>
            <StyledActions>
                <ActionButton type="submit" text="Войти" view="primary" stretched disabled={loading} />
                <Divider>Нет учётной записи или нужен доступ к дизайн-системе?</Divider>
                <ActionButton text="Запросить доступ" view="secondary" stretched onClick={onRequestAccess} />
            </StyledActions>
        </Root>
    );
};
