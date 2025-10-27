import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { TokenColorEditor } from '../theme';

import { TokensMenu, Workspace } from '../../components';
import { DesignSystem } from '../../../designSystem';
import { Theme } from '../../../themeBuilder';
import { getDataTokens } from '../../utils';
import { useEffect, useMemo, useState } from 'react';
import { Token } from '../../../themeBuilder/tokens/token';

interface ColorsOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
}

export const Colors = () => {
    const { designSystem, theme } = useOutletContext<ColorsOutletContextProps>();

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    const data = useMemo(() => getDataTokens(theme, 'color'), [theme]);

    const defaultSelectedTokenIndexes: [number, number, number] = useMemo(() => [0, 0, 0], []);

    const onTokenSelect = (tokens: Token[]) => {
        setTokens(tokens);
    };

    useEffect(() => {
        if (!data) {
            return;
        }

        const [tabIndex, groupIndex, tokenIndex] = defaultSelectedTokenIndexes;
        const tokens = data.groups[tabIndex].data[groupIndex].tokens[tokenIndex].data;

        setTokens(tokens);
    }, [theme, data, defaultSelectedTokenIndexes]);

    if (!data || !designSystem || !theme) {
        return null;
    }

    return (
        <Workspace
            menuBackground={backgroundTertiary}
            menu={
                <TokensMenu
                    header={designSystem.getParameters()?.packagesName}
                    subheader={designSystem.getParameters()?.packagesName}
                    data={data}
                    defaultSelectedTokenIndexes={defaultSelectedTokenIndexes}
                    onTokenSelect={onTokenSelect}
                />
            }
            content={<TokenColorEditor designSystem={designSystem} theme={theme} tokens={tokens} />}
        />
    );
};
