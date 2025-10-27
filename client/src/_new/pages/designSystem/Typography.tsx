import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { getDataTokens } from '../../utils';
import { TokensMenu, Workspace } from '../../components';
import { Theme } from '../../../themeBuilder';
import { DesignSystem } from '../../../designSystem';
import { TokenTypographyEditor } from '../theme';
import { Token } from '../../../themeBuilder/tokens/token';

interface TypographyOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
}

export const Typography = () => {
    const { designSystem, theme } = useOutletContext<TypographyOutletContextProps>();

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    const data = useMemo(() => getDataTokens(theme, 'typography'), [theme]);

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
    }, [data, defaultSelectedTokenIndexes]);

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
            content={<TokenTypographyEditor designSystem={designSystem} theme={theme} tokens={tokens} />}
        />
    );
};
