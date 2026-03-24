import { forwardRef, HTMLAttributes } from 'react';

import { Root, StyledLabel, StyledTrack, StyledThumb } from './Switch.styles';

interface SwitchProps extends HTMLAttributes<HTMLDivElement> {
    checked: boolean;
    label?: string;
    backgroundColor?: string;
    onToggle: (value: boolean) => void;
}

export const Switch = forwardRef<HTMLDivElement, SwitchProps>((props, ref) => {
    const { checked, label, backgroundColor, onToggle, ...rest } = props;

    const onClick = () => {
        if (onToggle) {
            onToggle(!checked);
        }
    };

    return (
        <Root {...rest} ref={ref}>
            <StyledLabel>{label}</StyledLabel>
            <StyledTrack checked={checked} backgroundColor={backgroundColor} onClick={onClick}>
                <StyledThumb checked={checked} />
            </StyledTrack>
        </Root>
    );
});

