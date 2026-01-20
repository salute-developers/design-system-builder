import { prettifyColorName } from '../../../../utils';
import { GeneralColor, Parameters } from '../../../../types';
import { EditButton } from '../../../../components';
import { popupSetupSteps } from '../../SetupParameters.utils';
import { accentColors } from './AccentSelectStep.utils';
import { StyledAccentSelect, StyledIconArrowsMoveVertical } from './AccentSelectStep.styles';

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
