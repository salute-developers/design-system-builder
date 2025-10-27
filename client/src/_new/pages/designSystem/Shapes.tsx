import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { backgroundTertiary } from '@salutejs/plasma-themes/tokens/plasma_infra';

import { getDataTokens } from '../../utils';
import { TokensMenu, Workspace } from '../../components';
import { Theme } from '../../../themeBuilder';
import { DesignSystem } from '../../../designSystem';
import { TokenShapeEditor } from '../theme';
import { Token } from '../../../themeBuilder/tokens/token';

interface ShapesOutletContextProps {
    designSystem?: DesignSystem;
    theme?: Theme;
}

export const Shapes = () => {
    const { designSystem, theme } = useOutletContext<ShapesOutletContextProps>();

    const [tokens, setTokens] = useState<Token[] | undefined>([]);
    const data = useMemo(() => getDataTokens(theme, 'shape'), [theme]);

    const defaultSelectedTokenIndexes: [number, number, number] = useMemo(() => [0, 1, 0], []);

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
            content={<TokenShapeEditor designSystem={designSystem} theme={theme} tokens={tokens} />}
        />
    );
};
