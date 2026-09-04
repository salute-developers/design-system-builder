import { ReactNode } from 'react';

import { Root } from './Tooltip.styles';

export type PlacementType = 'top' | 'bottom';

interface TooltipProps {
    text: ReactNode;
    offset?: [number, number];
    placement?: PlacementType;
    multiline?: boolean;
    maxWidth?: number;
}

export const Tooltip = (props: TooltipProps) => {
    const { text, offset = [0, 0], placement = 'top', multiline, maxWidth } = props;

    return (
        <Root offset={offset} placement={placement} multiline={multiline} maxWidth={maxWidth}>
            {text}
        </Root>
    );
};

