import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { general, PlasmaSaturation } from '@salutejs/plasma-colors';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';

import { HoverSelect } from '../components/HoverSelect';
import { EditButton } from '../components/EditButton';
import { TextField } from '../components/TextField';
import { SaturationSelect } from '../components/SaturationSelect';
import { AccentSelect } from '../components/AccentSelect';
import { GeneralColor, GrayTone, grayTones, Parameters } from '../types';
import { useGlobalKeyDown } from '../hooks';
import { prettifyColorName, transliterateToSnakeCase } from '../utils';
import { HeroTextField } from '../components/HeroTextField';
import { IconArrowBack, IconArrowRight, IconClose } from '@salutejs/plasma-icons';
import { IconButton } from '../components/IconButton';
import { HeroButton } from '../components/HeroButton';

export const Root = styled.div``;

const StyledSelectedParameters = styled.div<{ isReady?: boolean }>`
    z-index: 999;

    height: calc(100vh - 3rem);

    position: relative;

    ${({ isReady }) =>
        isReady
            ? css`
                  left: -21.25rem;
              `
            : css`
                  left: 0;
              `}

    transition: left 0.5s ease-in-out;
`;

const StyledWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const StyledEditButton = styled(EditButton)`
    margin: 1.5rem 0;
`;

const StyledHoverSelect = styled(HoverSelect)`
    margin: 3rem 0;
`;

const StyledAccentSelect = styled(AccentSelect)`
    margin: 3rem 0;
`;

const StyledSaturationSelect = styled(SaturationSelect)`
    margin: 3rem 0;
`;

const StyledPreviewSaturation = styled.div<{ color: string; saturationType?: 'fill' | 'stroke' }>`
    border-radius: 50%;
    width: 0.75rem;
    height: 0.75rem;
    background: ${({ color }) => color};

    ${({ saturationType }) =>
        saturationType === 'stroke' &&
        css`
            box-shadow: 0 0 0 0.0625rem rgba(0, 0, 0, 0.12) inset;
        `}
`;

const StyledIconButton = styled(IconArrowBack)`
    --icon-size: 3.25rem !important;
`;

const StyledReadyBlock = styled.div<{ isReady?: boolean }>`
    position: absolute;

    top: 3.75rem;

    ${({ isReady }) =>
        isReady
            ? css`
                  left: 22.5rem;
                  opacity: 1;
                  transition: left 0.5s ease-in-out 0.5s, opacity 0.5s ease-in-out 0.5s;
              `
            : css`
                  left: 25rem;
                  opacity: 0;
                  transition: left 0.5s ease-in-out, opacity 0.5s ease-in-out;
              `}
`;

const StyledHeader = styled.div`
    user-select: none;

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

const StyledResetParametersButton = styled.div`
    cursor: pointer;
    position: absolute;

    bottom: 3rem;

    color: var(--gray-color-500);

    &:hover {
        color: var(--gray-color-150);
    }

    display: flex;
    gap: 0.375rem;
    align-items: center;

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px; /* 133.333% */
`;

const StyledThemeModeSwitcher = styled.span<{ color: string }>`
    position: relative;
    display: inline-block;
    z-index: 99999;

    cursor: pointer;

    color: ${({ color }) => color};

    transition: transform 0.1s ease-in-out;

    :hover {
        transform: scale(1.02);
    }

    :active {
        transform: scale(0.99);
    }
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
    LIGHT_STROKE_SATURATION: 4,
    LIGHT_FILL_SATURATION: 5,
    DARK_STROKE_SATURATION: 6,
    DARK_FILL_SATURATION: 7,
    DONE: 8,
};

interface SetupParametersProps {
    parameters: Partial<Parameters>;
    themeMode: ThemeMode;
    // TODO: убрать эни и сделать жденерик
    onChangeParameters: (name: string, value: any) => void;
    onChangeGrayTone: (grayTone: string) => void;
    onChangeThemeMode: (themeMode: ThemeMode) => void;
    onResetParameters: () => void;
    onPrevPage: () => void;
    onNextPage: () => void;
}

export const SetupParameters = (props: SetupParametersProps) => {
    const {
        parameters,
        themeMode,
        onChangeParameters,
        onChangeGrayTone,
        onChangeThemeMode,
        onResetParameters,
        onPrevPage,
        onNextPage,
    } = props;

    const {
        projectName,
        packagesName,
        grayTone,
        accentColor = 'blue',
        lightStrokeSaturation = '50',
        lightFillSaturation = '50',
        darkStrokeSaturation = '50',
        darkFillSaturation = '50',
    } = parameters;

    const [popupSetupStep, setPopupContentStep] = useState<number>(2);
    const [editStep, setEditStep] = useState<number | null>(null);

    const packagesNameEdited = useRef(false);

    useGlobalKeyDown((event) => {
        if (event.key === 'Escape') {
            onPrevPage();
        }
    });

    const saturations = useMemo(
        () =>
            Object.entries(general[accentColor] || {})
                .reverse()
                .map(([saturation, value]) => ({
                    value: saturation,
                    color: value,
                })),
        [accentColor],
    );

    const onChangeProjectName = (event: ChangeEvent<HTMLInputElement>) => {
        onChangeParameters('projectName', event.target.value);
    };

    const onKeyDownProjectName = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && projectName) {
            onSubmitProjectName(projectName);
        }
    };

    const onSubmitProjectName = (value: string) => {
        onChangeParameters('projectName', value);
        setEditStep(null);

        if (!packagesNameEdited.current) {
            const transliteratedValue = transliterateToSnakeCase(value);
            onChangeParameters('packagesName', transliteratedValue);
        }
    };

    const onSubmitPackagesName = (value: string) => {
        packagesNameEdited.current = true;

        onChangeParameters('packagesName', value);
        setEditStep(null);
    };

    const onSelectGrayTone = (value: string) => {
        onChangeParameters('grayTone', value as GrayTone);

        if (editStep === null) {
            setPopupContentStep(popupSetupSteps.ACCENT_COLOR);
        }

        setEditStep(null);
    };

    const onSelectAccentColor = (value: string) => {
        onChangeParameters('accentColor', value as GeneralColor);

        if (editStep === null) {
            setPopupContentStep(popupSetupSteps.LIGHT_STROKE_SATURATION);
        }

        setEditStep(null);
    };

    const onSelectLightStrokeSaturation = (value: string) => {
        onChangeParameters('lightStrokeSaturation', Number(value) as PlasmaSaturation);

        if (editStep === null) {
            setPopupContentStep(popupSetupSteps.LIGHT_FILL_SATURATION);
        }

        setEditStep(null);
    };

    const onSelectLightFillSaturation = (value: string) => {
        onChangeParameters('lightFillSaturation', Number(value) as PlasmaSaturation);

        if (editStep === null) {
            setPopupContentStep(popupSetupSteps.DARK_STROKE_SATURATION);
        }

        setEditStep(null);
    };

    const onSelectDarkStrokeSaturation = (value: string) => {
        onChangeParameters('darkStrokeSaturation', Number(value) as PlasmaSaturation);

        if (editStep === null) {
            setPopupContentStep(popupSetupSteps.DARK_FILL_SATURATION);
        }

        setEditStep(null);
    };

    const onSelectDarkFillSaturation = (value: string) => {
        onChangeParameters('darkFillSaturation', Number(value) as PlasmaSaturation);

        if (editStep === null) {
            setPopupContentStep(popupSetupSteps.DONE);
        }

        setEditStep(null);
    };

    const handleResetParameters = () => {
        onResetParameters();
        packagesNameEdited.current = false;
    };

    useEffect(() => {
        if (
            ((popupSetupStep === popupSetupSteps.LIGHT_STROKE_SATURATION ||
                popupSetupStep === popupSetupSteps.LIGHT_FILL_SATURATION) &&
                editStep === null) ||
            editStep === popupSetupSteps.LIGHT_STROKE_SATURATION ||
            editStep === popupSetupSteps.LIGHT_FILL_SATURATION
        ) {
            onChangeThemeMode('light');
            return;
        }

        if (
            ((popupSetupStep === popupSetupSteps.DARK_STROKE_SATURATION ||
                popupSetupStep === popupSetupSteps.DARK_FILL_SATURATION) &&
                editStep === null) ||
            editStep === popupSetupSteps.DARK_STROKE_SATURATION ||
            editStep === popupSetupSteps.DARK_FILL_SATURATION
        ) {
            onChangeThemeMode('dark');
            return;
        }
    }, [popupSetupStep, editStep]);

    const isReady = popupSetupStep === popupSetupSteps.DONE && editStep === null;

    return (
        <Root>
            <StyledSelectedParameters isReady={isReady}>
                <StyledWrapper>
                    {popupSetupStep === popupSetupSteps.PROJECT_NAME || editStep === popupSetupSteps.PROJECT_NAME ? (
                        <HeroTextField
                            value={projectName}
                            placeholder="Начните с имени проекта"
                            dynamicContentRight={
                                <IconButton onClick={() => onSubmitProjectName(projectName || '')}>
                                    <StyledIconButton size="s" color="inherit" />
                                </IconButton>
                            }
                            dynamicHelper="без спецсимволов, можно по-русски — название пакетов транслитерируем по правилам"
                            onChange={onChangeProjectName}
                            onKeyDown={onKeyDownProjectName}
                        />
                    ) : (
                        <TextField
                            value={projectName}
                            label="Имя проекта"
                            onClick={() => {
                                setEditStep(popupSetupSteps.PROJECT_NAME);
                            }}
                        />
                    )}
                    <TextField
                        label="Имя пакетов в коде"
                        value={packagesName}
                        onClick={() => {
                            if (editStep === null) {
                                setEditStep(popupSetupSteps.PACKAGES_NAME);
                            }
                        }}
                        onCommit={onSubmitPackagesName}
                        onBlur={() => {
                            setEditStep(null);
                        }}
                    />
                </StyledWrapper>

                {canShowParameter(popupSetupSteps.GRAY_TONE, popupSetupStep, editStep) && (
                    <>
                        {popupSetupStep === popupSetupSteps.GRAY_TONE || editStep === popupSetupSteps.GRAY_TONE ? (
                            <StyledHoverSelect
                                label="Оттенок серого для базовых токенов"
                                items={grayTones}
                                grayTone={grayTone}
                                onHover={onChangeGrayTone}
                                onSelect={onSelectGrayTone}
                            />
                        ) : (
                            <StyledEditButton
                                label="Оттенок серого"
                                text={grayTones.find(({ value }) => value === grayTone)?.label || ''}
                                onClick={() => {
                                    setEditStep(popupSetupSteps.GRAY_TONE);
                                }}
                            />
                        )}
                    </>
                )}

                <StyledWrapper>
                    {canShowParameter(popupSetupSteps.ACCENT_COLOR, popupSetupStep, editStep) && (
                        <>
                            {popupSetupStep === popupSetupSteps.ACCENT_COLOR ||
                            editStep === popupSetupSteps.ACCENT_COLOR ? (
                                <StyledAccentSelect
                                    defaultValue="Green"
                                    label="Цвет бренда"
                                    items={accentColors}
                                    onSelect={onSelectAccentColor}
                                />
                            ) : (
                                <EditButton
                                    label="Цвет бренда"
                                    text={prettifyColorName(accentColor)}
                                    onClick={() => {
                                        setEditStep(popupSetupSteps.ACCENT_COLOR);
                                    }}
                                />
                            )}
                        </>
                    )}

                    {canShowParameter(popupSetupSteps.LIGHT_STROKE_SATURATION, popupSetupStep, editStep) && (
                        <>
                            {popupSetupStep === popupSetupSteps.LIGHT_STROKE_SATURATION ||
                            editStep === popupSetupSteps.LIGHT_STROKE_SATURATION ? (
                                <StyledSaturationSelect
                                    label="Оттенок для текстов в светлой теме"
                                    items={saturations}
                                    themeMode={themeMode}
                                    saturationType="stroke"
                                    onSelect={onSelectLightStrokeSaturation}
                                />
                            ) : (
                                <EditButton
                                    label="Оттенок для текстов в светлой теме"
                                    contentLeft={
                                        <StyledPreviewSaturation
                                            saturationType="stroke"
                                            color={general[accentColor][lightStrokeSaturation]}
                                        />
                                    }
                                    color={general[accentColor][lightStrokeSaturation]}
                                    text={lightStrokeSaturation.toString()}
                                    view="light"
                                    saturationType="stroke"
                                    isReady={isReady}
                                    onClick={() => {
                                        setEditStep(popupSetupSteps.LIGHT_STROKE_SATURATION);
                                    }}
                                />
                            )}
                        </>
                    )}

                    {canShowParameter(popupSetupSteps.LIGHT_FILL_SATURATION, popupSetupStep, editStep) && (
                        <>
                            {popupSetupStep === popupSetupSteps.LIGHT_FILL_SATURATION ||
                            editStep === popupSetupSteps.LIGHT_FILL_SATURATION ? (
                                <StyledSaturationSelect
                                    label="Для плашек в светлой теме"
                                    items={saturations}
                                    saturationType="fill"
                                    themeMode={themeMode}
                                    onSelect={onSelectLightFillSaturation}
                                />
                            ) : (
                                <EditButton
                                    label="Для плашек в светлой теме"
                                    contentLeft={
                                        <StyledPreviewSaturation
                                            saturationType="fill"
                                            color={general[accentColor][lightFillSaturation]}
                                        />
                                    }
                                    color={general[accentColor][lightFillSaturation]}
                                    text={lightFillSaturation.toString()}
                                    view="light"
                                    saturationType="fill"
                                    isReady={isReady}
                                    onClick={() => {
                                        setEditStep(popupSetupSteps.LIGHT_FILL_SATURATION);
                                    }}
                                />
                            )}
                        </>
                    )}

                    {canShowParameter(popupSetupSteps.DARK_STROKE_SATURATION, popupSetupStep, editStep) && (
                        <>
                            {popupSetupStep === popupSetupSteps.DARK_STROKE_SATURATION ||
                            editStep === popupSetupSteps.DARK_STROKE_SATURATION ? (
                                <StyledSaturationSelect
                                    label="Оттенок для текстов в тёмной теме"
                                    items={saturations}
                                    saturationType="stroke"
                                    themeMode={themeMode}
                                    onSelect={onSelectDarkStrokeSaturation}
                                />
                            ) : (
                                <EditButton
                                    label="Оттенок для текстов в тёмной теме"
                                    contentLeft={
                                        <StyledPreviewSaturation
                                            saturationType="stroke"
                                            color={general[accentColor][darkStrokeSaturation]}
                                        />
                                    }
                                    color={general[accentColor][darkStrokeSaturation]}
                                    text={darkStrokeSaturation.toString()}
                                    view="dark"
                                    saturationType="stroke"
                                    isReady={isReady}
                                    onClick={() => {
                                        setEditStep(popupSetupSteps.DARK_STROKE_SATURATION);
                                    }}
                                />
                            )}
                        </>
                    )}

                    {canShowParameter(popupSetupSteps.DARK_FILL_SATURATION, popupSetupStep, editStep) && (
                        <>
                            {popupSetupStep === popupSetupSteps.DARK_FILL_SATURATION ||
                            editStep === popupSetupSteps.DARK_FILL_SATURATION ? (
                                <StyledSaturationSelect
                                    label="Для плашек в тёмной теме"
                                    items={saturations}
                                    saturationType="fill"
                                    themeMode={themeMode}
                                    onSelect={onSelectDarkFillSaturation}
                                />
                            ) : (
                                <EditButton
                                    label="Для плашек в тёмной теме"
                                    contentLeft={
                                        <StyledPreviewSaturation
                                            saturationType="fill"
                                            color={general[accentColor][darkFillSaturation]}
                                        />
                                    }
                                    color={general[accentColor][darkFillSaturation]}
                                    text={darkFillSaturation.toString()}
                                    view="dark"
                                    saturationType="fill"
                                    isReady={isReady}
                                    onClick={() => {
                                        setEditStep(popupSetupSteps.DARK_FILL_SATURATION);
                                    }}
                                />
                            )}
                        </>
                    )}
                </StyledWrapper>
                <StyledResetParametersButton onClick={handleResetParameters}>
                    <IconClose size="xs" color="inherit" />
                    <>Сбросить</>
                </StyledResetParametersButton>
            </StyledSelectedParameters>

            <StyledReadyBlock isReady={isReady}>
                <StyledHeader>
                    Приблизительно так будет выглядеть цветовая схема проекта{' '}
                    <StyledThemeModeSwitcher
                        color={
                            general[accentColor || 'amber']?.[
                                themeMode === 'dark' ? darkStrokeSaturation : lightStrokeSaturation || '50'
                            ]
                        }
                        onClick={() => {
                            onChangeThemeMode(themeMode === 'dark' ? 'light' : 'dark');
                        }}
                    >
                        {themeMode === 'dark' ? 'в тёмной' : 'в светлой'}
                    </StyledThemeModeSwitcher>{' '}
                    теме
                </StyledHeader>
                <HeroButton
                    text="Сгенерировать"
                    backgroundColor={general[accentColor || 'amber']?.[darkFillSaturation || '50']}
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
