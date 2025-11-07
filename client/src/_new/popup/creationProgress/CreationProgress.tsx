import { useEffect, useState } from 'react';
import styled, { CSSObject } from 'styled-components';
import { textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { useGlobalKeyDown } from '../../hooks';
import { h6 } from '../../utils';
import { Parameters } from '../../types';
import { DesignSystem } from '../../../designSystem';
import { Progress } from '../../components';

const Root = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    height: 100%;
`;

const StyledDesignSystemName = styled.div`
    position: absolute;
    left: 0.75rem;
    top: 0.75rem;

    display: flex;
    align-items: center;
    width: 16rem;
    height: 2.5rem;
    padding: 0 0.5rem;

    color: ${textPrimary};

    ${h6 as CSSObject};
    font-weight: 600;
`;

const StyledProgress = styled(Progress)`
    position: absolute;
    width: 17.5rem;
    left: 50%;
    transform: translateX(-50%);
`;

interface CreationProgressProps {
    parameters: Partial<Parameters>;
    accentColor: string;
    onPrevPage: () => void;
    onNextPage: (designSystemName: string) => void;
}

export const CreationProgress = (props: CreationProgressProps) => {
    const { parameters, accentColor, onPrevPage, onNextPage } = props;
    const [designSystemCreated, setDesignSystemCreated] = useState(false);

    useGlobalKeyDown((event) => {
        if (event.key === 'Escape') {
            onPrevPage();
        }
    });

    //TODO: Временная демонстрация прогресса
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
