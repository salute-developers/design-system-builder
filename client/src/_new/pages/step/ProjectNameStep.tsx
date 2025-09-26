import { ChangeEvent, KeyboardEvent, MutableRefObject } from 'react';
import styled from 'styled-components';
import { IconArrowBack } from '@salutejs/plasma-icons';

import { Parameters } from '../../types';
import { transliterateToSnakeCase } from '../../utils';
import { HeroTextField } from '../../components/HeroTextField';
import { IconButton } from '../../components/IconButton';
import { TextField } from '../../components/TextField';
import { popupSetupSteps } from '../SetupParameters';

const StyledHeroTextField = styled(HeroTextField)`
    margin-bottom: 3rem;
`;

const StyledIconButton = styled(IconArrowBack)`
    --icon-size: 3.25rem !important;
`;

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
