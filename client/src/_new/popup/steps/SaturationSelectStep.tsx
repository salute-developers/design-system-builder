import { useMemo } from 'react';
import styled, { css } from 'styled-components';
import { ThemeMode } from '@salutejs/plasma-tokens-utils';
import { general, PlasmaSaturation } from '@salutejs/plasma-colors';
import { IconArrowsMoveVertical } from '@salutejs/plasma-icons';

import { GeneralColor, Parameters, SaturationType, ViewType } from '../../types';
import { SaturationSelect } from '../../features';
import { EditButton } from '../../components';

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

const StyledIconArrowsMoveVertical = styled(IconArrowsMoveVertical)`
    --icon-size: 0.75rem !important;
`;

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
            contentLeft={
                <StyledPreviewSaturation saturationType={saturationType} color={general[accentColor][saturation]} />
            }
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
