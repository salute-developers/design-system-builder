import { FocusEvent, MouseEvent, useState } from 'react';

import { IconButton, Tooltip } from '../../../../../../components';
import { ColorToken, GradientToken } from '../../../../../../controllers';
import { SubgroupNode } from '../../../../../../types';
import { SubgroupSection } from '../SubgroupSection';
import {
    StyledSubgroupHeader,
    StyledSubgroupName,
    StyledSubgroups,
    StyledSubgroupWrapper,
} from '../ModesSection/ModesSection.styles';

import {
    StyledIconChevronDown,
    StyledIconChevronRight,
    StyledIconInfoCircleOutline,
    StyledSubgroupInfo,
    StyledSubgroupToggle,
} from './ContextSection.styles';

const tooltipText =
    'Context помогают настроить, как токен выглядит в отдельных контекстах, например на тёмной или светлой поверхности.\n\nЗначения подтягиваются из Modes автоматически, но вы можете изменить их при необходимости.';

interface ContextSectionProps {
    nodes: SubgroupNode[];
    activeToken: ColorToken | GradientToken | undefined;
    currentOpacity: number;
    colorValueStatus: 'default' | 'negative';
    isLinked: (node: SubgroupNode) => boolean;
    onRelink: (node: SubgroupNode) => void;
    onPreviewClick: (event: MouseEvent, item: ColorToken | GradientToken) => void;
    onPaletteUnlink: (item: ColorToken | GradientToken) => () => void;
    onInputValueBlur: (item: ColorToken | GradientToken) => (event: FocusEvent<HTMLInputElement>) => void;
    onInputValueChange: () => void;
    onOpacityCommit: (item: ColorToken | GradientToken) => (opacity: number) => void;
}

export const ContextSection = (props: ContextSectionProps) => {
    const { nodes, isLinked, ...rest } = props;
    const [opened, setOpened] = useState(false);

    return (
        <StyledSubgroupWrapper>
            <StyledSubgroupHeader onClick={() => setOpened((prev) => !prev)}>
                <StyledSubgroupToggle>
                    {opened ? (
                        <StyledIconChevronDown size="xs" color="inherit" />
                    ) : (
                        <StyledIconChevronRight size="xs" color="inherit" />
                    )}
                </StyledSubgroupToggle>
                <StyledSubgroupName>Context</StyledSubgroupName>
                <StyledSubgroupInfo>
                    <IconButton>
                        <StyledIconInfoCircleOutline size="xs" color="inherit" />
                    </IconButton>
                    <Tooltip multiline maxWidth={16} placement="bottom" offset={[0.5, 0]} text={tooltipText} />
                </StyledSubgroupInfo>
            </StyledSubgroupHeader>
            <StyledSubgroups>
                {opened &&
                    nodes.map((node) => (
                        <SubgroupSection
                            key={node.subgroup}
                            node={node}
                            isContextSubgroup
                            linked={isLinked(node)}
                            {...rest}
                        />
                    ))}
            </StyledSubgroups>
        </StyledSubgroupWrapper>
    );
};
