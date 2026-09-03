import { FocusEvent, MouseEvent } from 'react';

import { ColorToken, GradientToken } from '../../../../../../controllers';
import { SubgroupNode } from '../../../../../../types';
import { SubgroupSection } from '../SubgroupSection';

import { StyledSubgroupHeader, StyledSubgroupName, StyledSubgroups, StyledSubgroupWrapper } from './ModesSection.styles';

interface ModesSectionProps {
    nodes: SubgroupNode[];
    activeToken: ColorToken | GradientToken | undefined;
    currentOpacity: number;
    colorValueStatus: 'default' | 'negative';
    onRelink: (node: SubgroupNode) => void;
    onPreviewClick: (event: MouseEvent, item: ColorToken | GradientToken) => void;
    onPaletteUnlink: (item: ColorToken | GradientToken) => () => void;
    onInputValueBlur: (item: ColorToken | GradientToken) => (event: FocusEvent<HTMLInputElement>) => void;
    onInputValueChange: () => void;
    onOpacityCommit: (item: ColorToken | GradientToken) => (opacity: number) => void;
}

export const ModesSection = (props: ModesSectionProps) => {
    const { nodes, ...rest } = props;

    return (
        <StyledSubgroupWrapper>
            <StyledSubgroupHeader>
                <StyledSubgroupName>Modes</StyledSubgroupName>
            </StyledSubgroupHeader>
            <StyledSubgroups>
                {nodes.map((node) => (
                    <SubgroupSection key={node.subgroup} node={node} isContextSubgroup={false} linked {...rest} />
                ))}
            </StyledSubgroups>
        </StyledSubgroupWrapper>
    );
};
