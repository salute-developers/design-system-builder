import { useNavigate } from 'react-router-dom';
import { KeyboardEvent, useState } from 'react';

import { Root } from '../Main.styles.ts';
import { Wrapper, StyledIconButton } from './Login.styles.ts';
import { HeroTextField } from '../../features';

import { IconButton, TextField } from '../../components';

type Step = 'login' | 'password';

const StepLogin = ({
    step,
    setStep,
    login,
    setLogin,
}: {
    step: Step;
    setStep: (val: Step) => void;
    login: any;
    setLogin: any;
}) => {
    const handleNext = () => setStep('password');

    const handleCommit = (e: string) => {
        setLogin(e);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleNext();
        }
    };

    if (step === 'login') {
        return (
            <HeroTextField
                value={login}
                placeholder="Введите логин"
                dynamicContentRight={
                    <IconButton onClick={handleNext}>
                        <StyledIconButton size="s" color="inherit" />
                    </IconButton>
                }
                onChange={(e) => setLogin(e.target.value)}
                onKeyDown={onKeyDown}
                compensativeWidth={0}
            />
        );
    }

    return <TextField label="Логин" value={login} onCommit={handleCommit} />;
};

const StepPassword = ({
    password,
    setPassword,
    handleSubmit,
}: {
    password: any;
    setPassword: any;
    handleSubmit: any;
}) => {
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <HeroTextField
            type="password"
            value={password}
            placeholder="Введите пароль"
            dynamicContentRight={
                <IconButton onClick={handleSubmit}>
                    <StyledIconButton size="s" color="inherit" />
                </IconButton>
            }
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            compensativeWidth={0}
        />
    );
};

const Login = () => {
    const [step, setStep] = useState<Step>('login');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');

    const navigate = useNavigate();

    const handleSubmit = () => {
        console.log('Authorized');
        localStorage.setItem('status', 'authorized');
        localStorage.setItem('login', login);
        localStorage.setItem('password', password);
        navigate('/');
    };

    return (
        <Root grayTone="warmGray" themeMode="dark">
            <Wrapper>
                <StepLogin step={step} setStep={setStep} login={login} setLogin={setLogin} />

                {step === 'password' && (
                    <StepPassword password={password} setPassword={setPassword} handleSubmit={handleSubmit} />
                )}
            </Wrapper>
        </Root>
    );
};

export { Login };
