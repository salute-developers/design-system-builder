import { useEffect, useState } from 'react';

import { Parameters } from '../../types';
import { DesignSystem } from '../../controllers';
import { Root, StyledDesignSystemName, StyledProgress } from './CreationProgress.styles';

interface CreationProgressProps {
    parameters: Partial<Parameters>;
    accentColor: string;
    onPrevPage: () => void;
    onNextPage: (designSystemName: string) => void;
}

export const CreationProgress = (props: CreationProgressProps) => {
    const { parameters, accentColor, onNextPage } = props;
    const [designSystemCreated, setDesignSystemCreated] = useState(false);

    // TODO: Временная демонстрация прогресса
    const [value, setValue] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setValue((value) => {
                if (value >= 100) {
                    clearInterval(interval);
                    return 100;
                }

                return value + 25;
            });
        }, 300);

        const createDesignSystem = async () => {
            console.log('Creating design system...', parameters);

            await DesignSystem.create({ name: parameters.packagesName, parameters });
            setDesignSystemCreated(true);
        };

        createDesignSystem();

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (designSystemCreated && value >= 100 && parameters.packagesName) {
            onNextPage(parameters.packagesName);
        }
    }, [designSystemCreated, value]);

    return (
        <Root>
            <StyledDesignSystemName>{parameters.projectName}</StyledDesignSystemName>
            <StyledProgress value={value} color={accentColor} />
        </Root>
    );
};
