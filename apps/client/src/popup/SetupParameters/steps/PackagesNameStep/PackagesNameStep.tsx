import { MutableRefObject } from 'react';

import { Parameters } from '../../../../types';
import { TextField } from '../../../../components';
import { popupSetupSteps } from '../../SetupParameters.utils';

interface PackagesNameStepProps {
    packagesName?: string;
    packagesNameEdited: MutableRefObject<boolean>;
    onChangeEditStep: (step: number | null) => void;
    onChangeParameters: <T extends keyof Parameters>(name: T, value: Parameters[T]) => void;
}

export const PackagesNameStep = (props: PackagesNameStepProps) => {
    const { packagesName, packagesNameEdited, onChangeEditStep, onChangeParameters } = props;

    const onSubmitPackagesName = (value: string) => {
        packagesNameEdited.current = true;

        onChangeParameters('packagesName', value);
        onChangeEditStep(null);
    };

    return (
        <TextField
            label="Имя пакетов в коде"
            value={packagesName}
            onCommit={onSubmitPackagesName}
            onClick={() => onChangeEditStep(popupSetupSteps.PACKAGES_NAME)}
            onBlur={() => onChangeEditStep(null)}
        />
    );
};
