import { ChangeEvent, HTMLAttributes, MouseEvent, ReactNode, useRef } from 'react';

import { StyledResetTokeValuesButton } from './LinkButton.styles';

interface LinkButtonProps extends HTMLAttributes<HTMLDivElement> {
    text: string;
    contentLeft?: ReactNode;
    contentRight?: ReactNode;
    accept?: string;
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
    onFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

export const LinkButton = (props: LinkButtonProps) => {
    const { text, contentLeft, contentRight, onClick, accept, onFileChange, ...rest } = props;

    const inputRef = useRef<HTMLInputElement>(null);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
        if (onFileChange) {
            inputRef.current?.click();
            return;
        }

        if (onClick) {
            onClick(event);
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (onFileChange) {
            onFileChange(event);
            event.target.value = '';
        }
    };

    return (
        <StyledResetTokeValuesButton onClick={handleClick} {...rest}>
            {contentLeft}
            <>{text}</>
            {contentRight}
            {onFileChange && (
                <input
                    type="file"
                    ref={inputRef}
                    accept={accept}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            )}
        </StyledResetTokeValuesButton>
    );
};
