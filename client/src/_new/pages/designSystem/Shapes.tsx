import { useParams } from 'react-router-dom';
import styled, { CSSObject } from 'styled-components';
import { textPrimary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { h6 } from '../../utils';
import { TokensEditor } from '../theme';
import { Workspace } from '../../components';

const Header = styled.div`
    padding: 0 0.5rem;
    box-sizing: border-box;
    height: 2.5rem;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
`;

const HeaderTitle = styled.div`
    overflow: hidden;
    color: ${textPrimary};
    text-overflow: ellipsis;

    ${h6 as CSSObject};
    font-weight: 600;
`;

export const Shapes = () => {
    // TODO: Загружать тему на этой странице и дальше передавать в контент
    const { designSystemName, designSystemVersion } = useParams();

    return (
        <Workspace
            menu={
                <>
                    <Header>
                        <HeaderTitle>{designSystemName}</HeaderTitle>
                        <HeaderTitle style={{ opacity: 0.5 }}>{designSystemVersion}</HeaderTitle>
                    </Header>
                    <Header>
                        <HeaderTitle>Редактирование токенов цвета</HeaderTitle>
                    </Header>
                    <Header>
                        <HeaderTitle style={{ fontWeight: 400 }}>Здесь будет красивый список токенов...</HeaderTitle>
                    </Header>
                </>
            }
            content={<TokensEditor selectedTokensTypes={['shape', 'shadow', 'spacing']} />}
        />
    );
};
