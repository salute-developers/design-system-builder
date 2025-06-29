import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Button } from '@salutejs/plasma-b2c';

// import {
//     Button as TestButton,
//     IconButton as TestIconButton,
//     Link as TestLink,
//     Checkbox as TestCheckbox,
// } from '@salutejs-ds/test';
// import webThemes from '@salutejs-ds/test/css/test.module.css';

import { PageWrapper } from './PageWrapper';
import { IconHomeAltOutline } from '@salutejs/plasma-icons';

const StyledActions = styled.div`
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
`;

const StyledDemoContent = styled.div`
    padding: 1rem;
    overflow-y: scroll;
    overflow-x: hidden;

    display: grid;
    gap: 1rem;
    height: 100%;
    justify-items: center; /* центрирует содержимое ячеек по горизонтали */

    grid-template-columns: repeat(6, 1fr);

    margin-bottom: 0.5rem;
    border-radius: 0.5rem;
    background: #0c0c0c;
`;

const StyledLinkExample = styled.div``;

export const Demo = () => {
    const navigate = useNavigate();

    const onGoHome = () => {
        navigate('/');
    };

    return (
        <PageWrapper>
            Нечего демонстрировать 😢
            {/* <StyledDemoContent className={webThemes.dark}>
                <TestButton
                    contentLeft={<IconHomeAltOutline color="inherit" size="s" />}
                    view="accent"
                    size="l"
                    text="Text"
                    value="Value"
                />
                <TestIconButton view="accent">
                    <IconHomeAltOutline size="s" />
                </TestIconButton>
                <StyledLinkExample>
                    Just <TestLink view="accent">link test</TestLink>
                </StyledLinkExample>
                <TestCheckbox size="l" label="Label" description="Description" />
            </StyledDemoContent> */}
            <StyledActions>
                <Button view="primary" onClick={onGoHome} text="Вернуться" />
            </StyledActions>
        </PageWrapper>
    );
};
