import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { useGlobalKeyDown } from '../hooks';
import { LoadingProgress } from '../components/LoadingProgress';

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

    color: var(--gray-color-150);

    font-family: 'SB Sans Display';
    font-size: 12px;
    font-style: normal;
    font-weight: 700;
    line-height: 16px;
`;

const StyledLoadingProgress = styled(LoadingProgress)`
    position: absolute;
    width: 17.5rem;
    left: 50%;
    transform: translateX(-50%);
`;

interface CreationProgressProps {
    projectName?: string;
    accentColor: string;
    onPrevPage: () => void;
}

export const CreationProgress = (props: CreationProgressProps) => {
    const { projectName, accentColor, onPrevPage } = props;

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

                return value + 5;
            });
        }, 300);

        return () => clearInterval(interval);
    }, []);

    return (
        <Root>
            <StyledDesignSystemName>{projectName}</StyledDesignSystemName>
            <StyledLoadingProgress value={value} color={accentColor} />
        </Root>
    );
};
