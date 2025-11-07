import styled from 'styled-components';
import { general } from '@salutejs/plasma-colors';
import { IconArrowsMoveVertical } from '@salutejs/plasma-icons';

import { prettifyColorName } from '../../utils';
import { GeneralColor, Parameters } from '../../types';
import { AccentSelect } from '../../features';
import { EditButton } from '../../components';
import { popupSetupSteps } from '.';

const StyledAccentSelect = styled(AccentSelect)`
    margin: 3rem 0;
`;

const StyledIconArrowsMoveVertical = styled(IconArrowsMoveVertical)`
    --icon-size: 0.75rem !important;
`;

const accentColors = Object.entries(general)
    .slice(0, -3)
    .map(([name, item]) => ({
        label: prettifyColorName(name),
        value: name,
        color: item[600],
    }));

interface AccentSelectStepProps {
    accentColor: GeneralColor;
    editMode: boolean;
    editStep: number | null;
    onChangeSetupStep: (step: number) => void;
    onChangeEditStep: (step: number | null) => void;
    onChangeParameters: <T extends keyof Parameters>(name: T, value: Parameters[T]) => void;
}

export const AccentSelectStep = (props: AccentSelectStepProps) => {
    const { accentColor, editMode, editStep, onChangeSetupStep, onChangeEditStep, onChangeParameters } = props;

    const onSelectAccentColor = (value: string) => {
        onChangeParameters('accentColor', value as GeneralColor);

        if (editStep === null) {
            onChangeSetupStep(popupSetupSteps.LIGHT_STROKE_SATURATION);
        }

        onChangeEditStep(null);
    };

    return editMode ? (
        <StyledAccentSelect
            label="Цвет бренда"
            defaultValue="green"
            items={accentColors}
            onSelect={onSelectAccentColor}
        />
    ) : (
        <EditButton
            label="Цвет бренда"
            text={prettifyColorName(accentColor)}
            contentRight={<StyledIconArrowsMoveVertical color="inherit" />}
            onClick={() => onChangeEditStep(popupSetupSteps.ACCENT_COLOR)}
        />
    );
};
