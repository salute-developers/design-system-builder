import { MouseEvent, useMemo, useState } from 'react';

import { EditButton } from '../../../../components';
import { ColorFormats } from '../../../../types';
import { convertColor, getNormalizedColor } from '../../../../utils';
import { StyledIconCopyOutline, StyledIconDone } from './ColorValueEditButton.styles';

interface ColorValueEditButtonProps {
    label: string;
    format: keyof ColorFormats;
    color: string;
    opacity: number;
}

export const ColorValueEditButton = (props: ColorValueEditButtonProps) => {
    const { label, color, opacity, format } = props;

    const [copied, setCopied] = useState<boolean | undefined>();

    const value = useMemo(() => {
        const colorValue = getNormalizedColor(color, opacity);

        return convertColor(colorValue)[format];
    }, [color, opacity, format]);

    const colorFormatContentRight =
        copied === undefined ? undefined : copied ? <StyledIconDone /> : <StyledIconCopyOutline />;

    const onButtonInteract = (newValue: boolean | undefined, toCopy?: boolean) => (_: MouseEvent<HTMLDivElement>) => {
        setCopied(newValue);

        if (toCopy) {
            navigator.clipboard.writeText(value);
        }
    };

    return (
        <EditButton
            label={label}
            text={value}
            contentRight={colorFormatContentRight}
            onClick={onButtonInteract(true, true)}
            onMouseEnter={onButtonInteract(false)}
            onMouseLeave={onButtonInteract(undefined)}
        />
    );
};
