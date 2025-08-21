import { ChangeEvent, KeyboardEvent, useEffect, useState } from 'react';
import styled, { css } from 'styled-components';
import { general, PlasmaSaturation } from '@salutejs/plasma-colors';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { useSearchParams, useNavigate } from 'react-router-dom';

import { HoverSelect } from '../components/HoverSelect';
import { EditButton } from '../components/EditButton';
import { TextField } from '../components/TextField';
import { SaturationSelect } from '../components/SaturationSelect';
import { AccentSelect } from '../components/AccentSelect';
import { GeneralColor, GrayTone, grayTones, Parameters } from '../types';
import { useGlobalKeyDown } from '../hooks';
import { prettifyColorName } from '../utils';
import { HeroTextField } from '../components/HeroTextField';
import { IconArrowBack, IconArrowRight } from '@salutejs/plasma-icons';
import { IconButton } from '../components/IconButton';
import { HeroButton } from '../components/HeroButton';

export const Root = styled.div``;

const StyledSelectedParameters = styled.div<{ isReady?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    z-index: 999;

    position: relative;
    left: 0;

    ${({ isReady }) =>
        isReady &&
        css`
            left: -21.25rem;
            opacity: 1;
        `}

    transition: left 0.5s ease-in-out;
`;

const StyledWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledEditButton = styled(EditButton)`
    margin-top: 1.5rem;
`;

const StyledEditButton2 = styled(EditButton)`
    margin-top: 0.5rem;
`;

const StyledHoverSelect = styled(HoverSelect)`
    margin-top: 3rem;
`;

const StyledAccentSelect = styled(AccentSelect)`
    margin-top: 3rem;
`;

const StyledSaturationSelect = styled(SaturationSelect)`
    margin-top: 3rem;
`;

const StyledPreviewSaturation = styled.div<{ color: string }>`
    border-radius: 50%;
    width: 0.75rem;
    height: 0.75rem;
    background: ${({ color }) => color};
`;

const StyledIconButton = styled(IconArrowBack)`
    --icon-size: 3.25rem !important;
`;

const StyledReadyBlock = styled.div<{ isReady?: boolean }>`
    position: absolute;

    top: 3.75rem;
    left: 25rem;
    opacity: 0;

    ${({ isReady }) =>
        isReady &&
        css`
            left: 22.5rem;
            opacity: 1;
        `}

    transition: left 0.5s ease-in-out, opacity 0.5s ease-in-out;
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

    margin-top: 2.5rem;

    color: var(--gray-color-500);

    font-family: 'SB Sans Display';
    font-size: 16px;
    font-style: normal;
    font-weight: 400;
    line-height: 24px;
`;

const accentColors = Object.entries(general)
    .slice(0, -3)
    .map(([name, item]) => ({
        label: prettifyColorName(name),
        value: name,
        color: item[600],
    }));

const canShowParameter = (stepNumber: number, popupContentStep: number, editStep: number | null) =>
    (popupContentStep >= stepNumber && (editStep === null || editStep === stepNumber)) ||
    (popupContentStep > stepNumber && editStep !== null);

const popupSetupSteps = {
    PROJECT_NAME: 0,
    PACKAGES_NAME: 1,
    GRAY_TONE: 2,
    ACCENT_COLOR: 3,
    LIGHT_SATURATION: 4,
    DARK_SATURATION: 5,
    DONE: 6,
};

interface SetupParametersProps {
    popupContentStep: number;
    parameters: Parameters;
    // TODO: убрать эни и сделать жденерик
    onChangeParameters: (name: string, value: any) => void;
    onChangePopupContentStep: (step: number) => void;
    onChangeGrayTone: (grayTone: string) => void;
    onChangeThemeMode: (themeMode: ThemeMode) => void;
    onPrevPage: () => void;
    onNextPage: () => void;
}

export const SetupParameters = (props: SetupParametersProps) => {
    const {
        popupContentStep,
        parameters,
        onChangeParameters,
        onChangeGrayTone,
        onChangeThemeMode,
        onChangePopupContentStep,
        onPrevPage,
        onNextPage,
    } = props;

    const [editStep, setEditStep] = useState<number | null>(null);

    console.log('popupContentStep', popupContentStep, 'editStep', editStep);

    useGlobalKeyDown((event) => {
        if (event.key === 'Escape') {
            onPrevPage();
        }
    });

    const saturations = Object.entries(general[parameters.accentColor])
        .reverse()
        .map(([saturation, value]) => ({
            value: saturation,
            color: value,
        }));

    const onChangeProjectName = (event: ChangeEvent<HTMLInputElement>) => {
        onChangeParameters('projectName', event.target.value);
    };

    const onKeyDownProjectName = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            onSubmitProjectName();
        }
    };

    const onSubmitProjectName = () => {
        setEditStep(null);
    };

    const onChangePackagesName = (event: ChangeEvent<HTMLInputElement>) => {
        onChangeParameters('packagesName', event.target.value);
    };

    const onKeyDownPackagesName = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            onSubmitPackagesName();
        }
    };

    const onSubmitPackagesName = () => {
        setEditStep(null);
    };

    const onSelectGrayTone = (value: string) => {
        onChangeParameters('grayTone', value as GrayTone);

        if (editStep === null) {
            onChangePopupContentStep(popupSetupSteps.ACCENT_COLOR);
        }

        setEditStep(null);
    };

    const onSelectAccentColor = (value: string) => {
        onChangeParameters('accentColor', value as GeneralColor);

        if (editStep === null) {
            onChangePopupContentStep(popupSetupSteps.LIGHT_SATURATION);
        }

        setEditStep(null);
    };

    const onSelectLightSaturation = (value: string) => {
        onChangeParameters('lightSaturation', Number(value) as PlasmaSaturation);
        onChangeThemeMode('dark');

        if (editStep === null) {
            onChangePopupContentStep(popupSetupSteps.DARK_SATURATION);
        }

        setEditStep(null);
    };

    const onSelectDarkSaturation = (value: string) => {
        onChangeParameters('darkSaturation', Number(value) as PlasmaSaturation);

        if (editStep === null) {
            onChangePopupContentStep(popupSetupSteps.DONE);
        }

        setEditStep(null);
    };

    useEffect(() => {
        if (
            (popupContentStep === popupSetupSteps.LIGHT_SATURATION && editStep === null) ||
            editStep === popupSetupSteps.LIGHT_SATURATION
        ) {
            onChangeThemeMode('light');
            return;
        }

        onChangeThemeMode('dark');
    }, [popupContentStep, editStep]);

    const isReady = popupContentStep === popupSetupSteps.DONE && editStep === null;

    return (
        <Root>
            <StyledSelectedParameters isReady={isReady}>
                <StyledWrapper>
                    {popupContentStep === popupSetupSteps.PROJECT_NAME || editStep === popupSetupSteps.PROJECT_NAME ? (
                        <HeroTextField
                            value={parameters.projectName}
                            placeholder="Начните с имени проекта"
                            dynamicContentRight={
                                <IconButton onClick={onSubmitProjectName}>
                                    <StyledIconButton size="s" color="inherit" />
                                </IconButton>
                            }
                            dynamicHelper="без спецсимволов, можно по-русски — название пакетов транслитерируем по правилам"
                            onChange={onChangeProjectName}
                            onKeyDown={onKeyDownProjectName}
                        />
                    ) : (
                        <TextField
                            value={parameters.projectName}
                            label="Имя проекта"
                            onClick={() => {
                                setEditStep(popupSetupSteps.PROJECT_NAME);
                            }}
                        />
                    )}
                    <TextField
                        label="Имя пакетов"
                        value={parameters.packagesName}
                        onClick={() => {
                            setEditStep(popupSetupSteps.PACKAGES_NAME);
                        }}
                        onChange={onChangePackagesName}
                        onKeyDown={onKeyDownPackagesName}
                    />
                </StyledWrapper>

                {canShowParameter(popupSetupSteps.GRAY_TONE, popupContentStep, editStep) && (
                    <>
                        {popupContentStep === popupSetupSteps.GRAY_TONE || editStep === popupSetupSteps.GRAY_TONE ? (
                            <StyledHoverSelect
                                label="Оттенок серого для базовых токенов"
                                items={grayTones}
                                onHover={onChangeGrayTone}
                                onSelect={onSelectGrayTone}
                            />
                        ) : (
                            <StyledEditButton
                                label="Оттенок серого"
                                text={grayTones.find(({ value }) => value === parameters.grayTone)?.label || ''}
                                onClick={() => {
                                    setEditStep(popupSetupSteps.GRAY_TONE);
                                }}
                            />
                        )}
                    </>
                )}

                {canShowParameter(popupSetupSteps.ACCENT_COLOR, popupContentStep, editStep) && (
                    <>
                        {popupContentStep === popupSetupSteps.ACCENT_COLOR ||
                        editStep === popupSetupSteps.ACCENT_COLOR ? (
                            <StyledAccentSelect
                                defaultValue="Green"
                                label="Цвет для акцентов"
                                items={accentColors}
                                onSelect={onSelectAccentColor}
                            />
                        ) : (
                            <StyledEditButton
                                label="Цвет для акцентов"
                                text={prettifyColorName(parameters.accentColor)}
                                onClick={() => {
                                    setEditStep(popupSetupSteps.ACCENT_COLOR);
                                }}
                            />
                        )}
                    </>
                )}

                {canShowParameter(popupSetupSteps.LIGHT_SATURATION, popupContentStep, editStep) && (
                    <>
                        {popupContentStep === popupSetupSteps.LIGHT_SATURATION ||
                        editStep === popupSetupSteps.LIGHT_SATURATION ? (
                            <StyledSaturationSelect
                                onSelect={onSelectLightSaturation}
                                label="Оттенок для светлой темы"
                                items={saturations}
                            />
                        ) : (
                            <StyledEditButton2
                                label="Оттенок для светлой темы"
                                contentLeft={
                                    <StyledPreviewSaturation
                                        color={general[parameters.accentColor][parameters.lightSaturation]}
                                    />
                                }
                                color={general[parameters.accentColor][parameters.lightSaturation]}
                                text={parameters.lightSaturation.toString()}
                                view="light"
                                onClick={() => {
                                    setEditStep(popupSetupSteps.LIGHT_SATURATION);
                                }}
                            />
                        )}
                    </>
                )}

                {canShowParameter(popupSetupSteps.DARK_SATURATION, popupContentStep, editStep) && (
                    <>
                        {popupContentStep === popupSetupSteps.DARK_SATURATION ||
                        editStep === popupSetupSteps.DARK_SATURATION ? (
                            <StyledSaturationSelect
                                onSelect={onSelectDarkSaturation}
                                label="Оттенок для тёмной"
                                items={saturations}
                            />
                        ) : (
                            <StyledEditButton2
                                label="Для тёмной"
                                contentLeft={
                                    <StyledPreviewSaturation
                                        color={general[parameters.accentColor][parameters.darkSaturation]}
                                    />
                                }
                                color={general[parameters.accentColor][parameters.darkSaturation]}
                                text={parameters.darkSaturation.toString()}
                                view="dark"
                                onClick={() => {
                                    setEditStep(popupSetupSteps.DARK_SATURATION);
                                }}
                            />
                        )}
                    </>
                )}
            </StyledSelectedParameters>

            <StyledReadyBlock isReady={isReady}>
                <StyledHeader>Приблизительно так будет выглядеть цветовая схема проекта</StyledHeader>
                <HeroButton
                    text="Сгенерировать"
                    backgroundColor={general[parameters.accentColor][parameters.darkSaturation]}
                    contentRight={<IconArrowRight size="xs" color="inherit" />}
                    onClick={() => onNextPage()}
                />
                <StyledDisclaimer>
                    После создания можно будет изменить все параметры и точечно настроить каждый токен и компонент
                </StyledDisclaimer>
            </StyledReadyBlock>
        </Root>
    );
};
