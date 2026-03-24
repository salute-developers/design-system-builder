import { ChangeEvent, KeyboardEvent, MutableRefObject } from 'react';

import { Parameters } from '../../../../types';
import { transliterateToSnakeCase } from '../../../../utils';
import { IconButton, TextField } from '../../../../components';
import { popupSetupSteps } from '../../SetupParameters.utils';
import { StyledHeroTextField, StyledIconButton } from './ProjectNameStep.styles';

interface ProjectNameStepProps {
    packagesNameEdited: MutableRefObject<boolean>;
    projectName?: string;
    editMode: boolean;
    onChangeEditStep: (step: number | null) => void;
    onChangeParameters: <T extends keyof Parameters>(name: T, value: Parameters[T]) => void;
}

export const ProjectNameStep = (props: ProjectNameStepProps) => {
    const { projectName, packagesNameEdited, editMode, onChangeEditStep, onChangeParameters } = props;

    const onChangeProjectName = (event: ChangeEvent<HTMLInputElement>) => {
        onChangeParameters('projectName', event.target.value);
    };

    const onKeyDownProjectName = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && projectName) {
            onSubmitProjectName(projectName);
        }
    };

    const onSubmitProjectName = (value?: string) => {
        if (!value) {
            return;
        }

        onChangeParameters('projectName', value);
        onChangeEditStep(null);

        if (!packagesNameEdited.current) {
            const transliteratedValue = transliterateToSnakeCase(value);
            onChangeParameters('packagesName', transliteratedValue);
        }
    };

    return editMode ? (
        <StyledHeroTextField
            value={projectName}
            placeholder="Начните с имени проекта"
            dynamicContentRight={
                <IconButton onClick={() => onSubmitProjectName(projectName)}>
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
            label="Название проекта"
            onClick={() => onChangeEditStep(popupSetupSteps.PROJECT_NAME)}
        />
    );
};
