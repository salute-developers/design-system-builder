import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';

import { TextField } from '../components/TextField';
import { useGlobalKeyDown } from '../hooks';
import { EditButton } from '../components/EditButton';
import { HeroButton } from '../components/HeroButton';
import { IconArrowRight } from '@salutejs/plasma-icons';
import { grayTones, Parameters } from '../types';
import { prettifyColorName } from '../utils';
import { general } from '@salutejs/plasma-colors';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    gap: 3rem;
`;

const StyledSelectedParameters = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    position: absolute;
    top: 3.75rem;
    left: 1.25rem;
`;

const StyledEditButton = styled(EditButton)`
    margin-top: 1.5rem;
`;

const StyledHeader = styled.div`
    width: 30rem;

    margin-bottom: 4rem;

    color: var(--gray-color-100);

    font-family: 'SB Sans Display';
    font-size: 48px;
    font-style: normal;
    font-weight: 400;
    line-height: 52px;
`;

const StyledDisclaimer = styled.div`
    width: 16.25rem;

    margin-bottom: 2.5rem;

    color: var(--gray-color-500);

    font-family: 'SB Sans Display';
    font-size: 16px;
    font-style: normal;
    font-weight: 400;
    line-height: 24px;
`;

const StyledPreviewSaturation = styled.div<{ color: string }>`
    border-radius: 50%;
    width: 0.75rem;
    height: 0.75rem;
    background: ${({ color }) => color};
`;

interface CreateDesignSystemProps {
    parameters?: Parameters;
    onSetupPage: () => void;
    onPrevPage: () => void;
    onNextPage: () => void;
}

export const CreateDesignSystem = (props: CreateDesignSystemProps) => {
    const { parameters, onPrevPage, onNextPage, onSetupPage } = props;

    const [, setSearchParams] = useSearchParams();

    useGlobalKeyDown((event) => {
        if (event.key === 'Escape') {
            onPrevPage();
        }
    });

    if (!parameters) {
        return null;
    }

    const { projectName, packagesName, grayTone, accentColor, lightSaturation, darkSaturation } = parameters;

    const onClickEditStep = (step: number) => {
        setSearchParams({ editStep: step.toString() });
        onSetupPage();
    };

    return (
        <Root>
            <StyledSelectedParameters>
                <TextField label="Имя проекта" value={projectName} onClick={() => onClickEditStep(0)} />
                <TextField label="Имя проекта" value={packagesName} onClick={() => onClickEditStep(0)} />
                <StyledEditButton
                    label="Оттенок серого"
                    text={grayTones.find(({ value }) => value === grayTone)?.label || ''}
                    onClick={() => {
                        onClickEditStep(0);
                    }}
                />
                <StyledEditButton
                    label="Цвет для акцентов"
                    text={prettifyColorName(accentColor)}
                    onClick={() => onClickEditStep(1)}
                />
                <EditButton
                    label="Оттенок для светлой темы"
                    contentLeft={<StyledPreviewSaturation color={general[accentColor][lightSaturation]} />}
                    color={general[accentColor][lightSaturation]}
                    text={lightSaturation.toString()}
                    view="light"
                    onClick={() => onClickEditStep(2)}
                />
                <EditButton
                    label="Для тёмной"
                    contentLeft={<StyledPreviewSaturation color={general[accentColor][darkSaturation]} />}
                    color={general[accentColor][darkSaturation]}
                    text={darkSaturation.toString()}
                    view="dark"
                    onClick={() => onClickEditStep(3)}
                />
            </StyledSelectedParameters>
            <StyledHeader>Приблизительно так будет выглядеть цветовая схема проекта</StyledHeader>
            <HeroButton
                text="Сгенерировать"
                backgroundColor={general[accentColor][darkSaturation]}
                contentRight={<IconArrowRight size="xs" color="inherit" />}
                onClick={() => onNextPage()}
            />
            <StyledDisclaimer>
                После создания можно будет изменить все параметры и точечно настроить каждый токен и компонент
            </StyledDisclaimer>
        </Root>
    );
};
