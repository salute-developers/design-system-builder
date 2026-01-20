import { useMemo } from 'react';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general, PlasmaSaturation } from '@salutejs/plasma-colors';

import { GeneralColor, Parameters, SaturationType, ViewType } from '../../../../types';
import { EditButton } from '../../../../components';
import {
    StyledSaturationSelect,
    StyledPreviewSaturation,
    StyledIconArrowsMoveVertical,
} from './SaturationSelectStep.styles';

interface SaturationSelectStepProps {
    name: keyof Parameters;
    accentColor: GeneralColor;
    saturation: PlasmaSaturation;
    label: string;
    view: ViewType;
    saturationType: SaturationType;
    themeMode: ThemeMode;
    isReady: boolean;
    currentStep: number;
    nextStep: number;
    editMode: boolean;
    editStep: number | null;
    onChangeSetupStep: (step: number) => void;
    onChangeEditStep: (step: number | null) => void;
    onChangeParameters: <T extends keyof Parameters>(name: T, value: Parameters[T]) => void;
}

export const SaturationSelectStep = (props: SaturationSelectStepProps) => {
    const {
        name,
        accentColor,
        saturation,
        label,
        view,
        saturationType,
        themeMode,
        isReady,
        currentStep,
        nextStep,
        editMode,
        editStep,
        onChangeSetupStep,
        onChangeEditStep,
        onChangeParameters,
    } = props;

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

    const onSelectSaturation = (value: string) => {
        onChangeParameters(name, Number(value) as PlasmaSaturation);

        if (editStep === null) {
            onChangeSetupStep(nextStep);
        }

        onChangeEditStep(null);
    };

    return editMode ? (
        <StyledSaturationSelect
            label={label}
            items={saturations}
            themeMode={themeMode}
            saturationType={saturationType}
            onSelect={onSelectSaturation}
        />
    ) : (
        <EditButton
            label={label}
            contentLeft={<StyledPreviewSaturation color={general[accentColor][saturation]} />}
            contentRight={<StyledIconArrowsMoveVertical color="inherit" />}
            color={general[accentColor][saturation]}
            text={saturation.toString()}
            view={view}
            saturationType={saturationType}
            isReady={isReady}
            onClick={() => onChangeEditStep(currentStep)}
        />
    );
};
