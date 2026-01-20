import { useEffect, useRef, useState } from 'react';
import { general } from '@salutejs/plasma-colors';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { IconArrowRight, IconClose } from '@salutejs/plasma-icons';

import { Parameters } from '../../types';
import { useGlobalKeyDown } from '../../hooks';
import { BasicButton } from '../../components';
import { ProjectNameStep, PackagesNameStep, GrayToneStep, AccentSelectStep, SaturationSelectStep } from '.';
import { fnCanShowStep, fnIsEditMode, popupSetupSteps } from './SetupParameters.utils';
import {
    Root,
    StyledSelectedParameters,
    StyledWrapper,
    StyledReadyBlock,
    StyledHeader,
    StyledDisclaimer,
    StyledThemeModeSwitcher,
    StyledLinkButton,
    StyledSeparator,
} from './SetupParameters.styles';

interface SetupParametersProps {
    parameters: Partial<Parameters>;
    themeMode: ThemeMode;
    onChangeParameters: <T extends keyof Parameters>(name: T, value: Parameters[T]) => void;
    onChangeGrayTone: (grayTone: string) => void;
    onChangeThemeMode: (themeMode: ThemeMode) => void;
    onResetParameters: () => void;
    onPrevPage: () => void;
    onNextPage: (data: Partial<Parameters>) => void;
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
        lightStrokeSaturation = 50,
        lightFillSaturation = 50,
        darkStrokeSaturation = 50,
        darkFillSaturation = 50,
    } = parameters;

    const [popupSetupStep, setPopupSetupStep] = useState<number>(2);
    const [editStep, setEditStep] = useState<number | null>(null);

    const packagesNameEdited = useRef(false);

    const isReady = popupSetupStep === popupSetupSteps.DONE && editStep === null;
    const canShowSeparator =
        editStep !== popupSetupSteps.LIGHT_FILL_SATURATION &&
        editStep !== popupSetupSteps.DARK_STROKE_SATURATION &&
        popupSetupStep !== popupSetupSteps.LIGHT_FILL_SATURATION &&
        popupSetupStep !== popupSetupSteps.DARK_STROKE_SATURATION;

    const themeModeSwitcher =
        themeMode === 'dark'
            ? {
                  saturation: darkStrokeSaturation,
                  newThemeMode: 'light',
                  text: 'в тёмной',
              }
            : {
                  saturation: lightStrokeSaturation,
                  newThemeMode: 'dark',
                  text: 'в светлой',
              };

    const canShowStep = fnCanShowStep(popupSetupStep, editStep);
    const isEditMode = fnIsEditMode(popupSetupStep, editStep);

    useGlobalKeyDown((event) => {
        if (event.key === 'Escape') {
            onPrevPage();
        }
    });

    const handleSetEditStep = (step: number | null) => {
        setEditStep(step);
    };

    const handleSetSetupStep = (step: number) => {
        setPopupSetupStep(step);
    };

    const handleResetParameters = () => {
        onResetParameters();
        packagesNameEdited.current = false;
    };

    const handleThemeModeSwitch = () => {
        onChangeThemeMode(themeModeSwitcher.newThemeMode as ThemeMode);
    };

    const handleSubmitParameters = () => {
        onNextPage(parameters);
    };

    useEffect(() => {
        const lightSteps = [popupSetupSteps.LIGHT_STROKE_SATURATION, popupSetupSteps.LIGHT_FILL_SATURATION];
        const darkSteps = [popupSetupSteps.DARK_STROKE_SATURATION, popupSetupSteps.DARK_FILL_SATURATION];

        if ((lightSteps.includes(popupSetupStep) && editStep === null) || (editStep && lightSteps.includes(editStep))) {
            onChangeThemeMode('light');
            return;
        }

        if ((darkSteps.includes(popupSetupStep) && editStep === null) || (editStep && darkSteps.includes(editStep))) {
            onChangeThemeMode('dark');
            return;
        }
    }, [popupSetupStep, editStep]);

    return (
        <Root>
            <StyledSelectedParameters isReady={isReady}>
                <StyledWrapper>
                    <ProjectNameStep
                        packagesNameEdited={packagesNameEdited}
                        projectName={projectName}
                        editMode={isEditMode(popupSetupSteps.PROJECT_NAME)}
                        onChangeEditStep={handleSetEditStep}
                        onChangeParameters={onChangeParameters}
                    />
                    <PackagesNameStep
                        packagesNameEdited={packagesNameEdited}
                        packagesName={packagesName}
                        onChangeEditStep={handleSetEditStep}
                        onChangeParameters={onChangeParameters}
                    />
                </StyledWrapper>

                {canShowStep(popupSetupSteps.GRAY_TONE) && (
                    <GrayToneStep
                        grayTone={grayTone}
                        editMode={isEditMode(popupSetupSteps.GRAY_TONE)}
                        editStep={editStep}
                        onChangeEditStep={handleSetEditStep}
                        onChangeSetupStep={handleSetSetupStep}
                        onChangeParameters={onChangeParameters}
                        onChangeGrayTone={onChangeGrayTone}
                    />
                )}

                <StyledWrapper>
                    {canShowStep(popupSetupSteps.ACCENT_COLOR) && (
                        <AccentSelectStep
                            accentColor={accentColor}
                            editMode={isEditMode(popupSetupSteps.ACCENT_COLOR)}
                            editStep={editStep}
                            onChangeEditStep={handleSetEditStep}
                            onChangeSetupStep={handleSetSetupStep}
                            onChangeParameters={onChangeParameters}
                        />
                    )}

                    {canShowStep(popupSetupSteps.LIGHT_STROKE_SATURATION) && (
                        <SaturationSelectStep
                            label="Оттенок для текстов в светлой теме"
                            view="light"
                            saturationType="stroke"
                            name="lightStrokeSaturation"
                            saturation={lightStrokeSaturation}
                            accentColor={accentColor}
                            themeMode={themeMode}
                            isReady={isReady}
                            currentStep={popupSetupSteps.LIGHT_STROKE_SATURATION}
                            nextStep={popupSetupSteps.LIGHT_FILL_SATURATION}
                            editMode={isEditMode(popupSetupSteps.LIGHT_STROKE_SATURATION)}
                            editStep={editStep}
                            onChangeEditStep={handleSetEditStep}
                            onChangeSetupStep={handleSetSetupStep}
                            onChangeParameters={onChangeParameters}
                        />
                    )}

                    {canShowStep(popupSetupSteps.LIGHT_FILL_SATURATION) && (
                        <SaturationSelectStep
                            label="Для плашек в светлой теме"
                            view="light"
                            saturationType="fill"
                            name="lightFillSaturation"
                            saturation={lightFillSaturation}
                            accentColor={accentColor}
                            themeMode={themeMode}
                            isReady={isReady}
                            currentStep={popupSetupSteps.LIGHT_FILL_SATURATION}
                            nextStep={popupSetupSteps.DARK_STROKE_SATURATION}
                            editMode={isEditMode(popupSetupSteps.LIGHT_FILL_SATURATION)}
                            editStep={editStep}
                            onChangeEditStep={handleSetEditStep}
                            onChangeSetupStep={handleSetSetupStep}
                            onChangeParameters={onChangeParameters}
                        />
                    )}
                </StyledWrapper>

                {canShowSeparator && <StyledSeparator />}

                <StyledWrapper>
                    {canShowStep(popupSetupSteps.DARK_STROKE_SATURATION) && (
                        <SaturationSelectStep
                            label="Оттенок для текстов в тёмной теме"
                            view="dark"
                            saturationType="stroke"
                            name="darkStrokeSaturation"
                            saturation={darkStrokeSaturation}
                            accentColor={accentColor}
                            themeMode={themeMode}
                            isReady={isReady}
                            currentStep={popupSetupSteps.DARK_STROKE_SATURATION}
                            nextStep={popupSetupSteps.DARK_FILL_SATURATION}
                            editMode={isEditMode(popupSetupSteps.DARK_STROKE_SATURATION)}
                            editStep={editStep}
                            onChangeEditStep={handleSetEditStep}
                            onChangeSetupStep={handleSetSetupStep}
                            onChangeParameters={onChangeParameters}
                        />
                    )}

                    {canShowStep(popupSetupSteps.DARK_FILL_SATURATION) && (
                        <SaturationSelectStep
                            label="Для плашек в тёмной теме"
                            view="dark"
                            saturationType="fill"
                            name="darkFillSaturation"
                            saturation={darkFillSaturation}
                            accentColor={accentColor}
                            themeMode={themeMode}
                            isReady={isReady}
                            currentStep={popupSetupSteps.DARK_FILL_SATURATION}
                            nextStep={popupSetupSteps.DONE}
                            editMode={isEditMode(popupSetupSteps.DARK_FILL_SATURATION)}
                            editStep={editStep}
                            onChangeEditStep={handleSetEditStep}
                            onChangeSetupStep={handleSetSetupStep}
                            onChangeParameters={onChangeParameters}
                        />
                    )}
                </StyledWrapper>

                <StyledLinkButton
                    text="Сбросить"
                    contentLeft={<IconClose size="xs" color="inherit" />}
                    onClick={handleResetParameters}
                />
            </StyledSelectedParameters>

            <StyledReadyBlock isReady={isReady}>
                <StyledHeader>
                    Приблизительно так будет выглядеть цветовая схема проекта{' '}
                    <StyledThemeModeSwitcher
                        color={general[accentColor]?.[themeModeSwitcher.saturation]}
                        onClick={handleThemeModeSwitch}
                    >
                        {themeModeSwitcher.text}
                    </StyledThemeModeSwitcher>
                    теме
                </StyledHeader>
                <BasicButton
                    size="l"
                    text="Сгенерировать"
                    backgroundColor={general[accentColor][darkFillSaturation]}
                    contentRight={<IconArrowRight size="xs" color="inherit" />}
                    onClick={handleSubmitParameters}
                />
                <StyledDisclaimer>
                    После создания можно будет изменить все параметры и точечно настроить каждый токен и компонент
                </StyledDisclaimer>
            </StyledReadyBlock>
        </Root>
    );
};

