import { GrayTone, grayTones, Parameters } from '../../../../types';
import { popupSetupSteps } from '../../SetupParameters.utils';
import { StyledHoverSelect, StyledEditButton, StyledIconArrowsMoveVertical } from './GrayToneStep.styles';

interface GrayToneStepProps {
    editMode: boolean;
    editStep: number | null;
    grayTone?: GrayTone;
    onChangeGrayTone: (grayTone: string) => void;
    onChangeSetupStep: (step: number) => void;
    onChangeEditStep: (step: number | null) => void;
    onChangeParameters: <T extends keyof Parameters>(name: T, value: Parameters[T]) => void;
}

export const GrayToneStep = (props: GrayToneStepProps) => {
    const { editMode, editStep, grayTone, onChangeSetupStep, onChangeEditStep, onChangeGrayTone, onChangeParameters } =
        props;

    const onSelectGrayTone = (value: string) => {
        onChangeParameters('grayTone', value as GrayTone);

        if (editStep === null) {
            onChangeSetupStep(popupSetupSteps.ACCENT_COLOR);
        }

        onChangeEditStep(null);
    };

    return editMode ? (
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
            contentRight={<StyledIconArrowsMoveVertical color="inherit" />}
            onClick={() => onChangeEditStep(popupSetupSteps.GRAY_TONE)}
        />
    );
};
