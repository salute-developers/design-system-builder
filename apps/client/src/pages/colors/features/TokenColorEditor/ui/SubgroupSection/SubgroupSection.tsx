import { FocusEvent, MouseEvent } from 'react';
import { IconLink, IconLinkBrokenChain } from '@salutejs/plasma-icons';

import { IconButton, Tooltip } from '../../../../../../components';
import { ColorToken, GradientToken } from '../../../../../../controllers';
import { SubgroupNode } from '../../../../../../types';
import { TokenValueField } from '../TokenValueField';

import { StyledLinkTooltipAnchor, StyledSubgroup, StyledSubgroupLabel } from './SubgroupSection.styles';

const linkedTooltipText =
    'Подтемы наследуют значения из Modes. Ручное изменение отключает связь. Нажмите на иконку связи, чтобы восстановить наследование и сбросить значения к дефолтным.';

const unlinkedTooltipText =
    'Связь отключена. Используется ручные значения. Нажмите на иконку связи, чтобы вернуть наследование из Modes и сбросить изменения.';

interface SubgroupSectionProps {
    node: SubgroupNode;
    isContextSubgroup: boolean;
    linked: boolean;
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

export const SubgroupSection = (props: SubgroupSectionProps) => {
    const {
        node,
        isContextSubgroup,
        linked,
        activeToken,
        currentOpacity,
        colorValueStatus,
        onRelink,
        onPreviewClick,
        onPaletteUnlink,
        onInputValueBlur,
        onInputValueChange,
        onOpacityCommit,
    } = props;

    const { subgroup, data: modeNodes } = node;

    const subgroupLabel = subgroup.charAt(0).toUpperCase() + subgroup.slice(1);

    const onClick = (event: MouseEvent) => {
        if (linked) {
            return;
        }

        event.stopPropagation();
        onRelink(node);
    };

    return (
        <StyledSubgroup>
            {isContextSubgroup && (
                <StyledSubgroupLabel>
                    {subgroupLabel}
                    <StyledLinkTooltipAnchor>
                        <IconButton disabled={linked} onClick={onClick}>
                            {linked ? (
                                <IconLink size="xs" color="inherit" />
                            ) : (
                                <IconLinkBrokenChain size="xs" color="inherit" />
                            )}
                        </IconButton>
                        <Tooltip
                            multiline
                            maxWidth={16}
                            placement="bottom"
                            offset={[0.5, 0]}
                            text={linked ? linkedTooltipText : unlinkedTooltipText}
                        />
                    </StyledLinkTooltipAnchor>
                </StyledSubgroupLabel>
            )}
            {modeNodes.map(({ mode, data: { value, item } }) => (
                <TokenValueField
                    key={mode}
                    mode={mode}
                    value={value}
                    item={item}
                    isActive={item === activeToken}
                    currentOpacity={currentOpacity}
                    colorValueStatus={colorValueStatus}
                    onPreviewClick={onPreviewClick}
                    onPaletteUnlink={onPaletteUnlink}
                    onInputValueBlur={onInputValueBlur}
                    onInputValueChange={onInputValueChange}
                    onOpacityCommit={onOpacityCommit}
                />
            ))}
        </StyledSubgroup>
    );
};
