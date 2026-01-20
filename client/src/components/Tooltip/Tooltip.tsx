import { Root } from './Tooltip.styles';

export type PlacementType = 'top' | 'bottom';

interface TooltipProps {
    text: string;
    offset?: [number, number];
    placement?: PlacementType;
}

export const Tooltip = (props: TooltipProps) => {
    const { text, offset = [0, 0], placement = 'top' } = props;

    return (
        <Root offset={offset} placement={placement}>
            {text}
        </Root>
    );
};

