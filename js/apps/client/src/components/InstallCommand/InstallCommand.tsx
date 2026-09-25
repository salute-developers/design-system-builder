import { HTMLAttributes, useEffect, useRef, useState } from 'react';
import { IconCopyOutline, IconDone } from '@salutejs/plasma-icons';

import { Root, StyledCommand, StyledCommandText, StyledCopyButton, StyledLabel } from './InstallCommand.styles';

interface InstallCommandProps extends HTMLAttributes<HTMLDivElement> {
    command: string;
    label?: string;
}

const COPIED_TIMEOUT = 2_000;

export const InstallCommand = (props: InstallCommandProps) => {
    const { command, label, ...rest } = props;

    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(command);
            setCopied(true);

            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), COPIED_TIMEOUT);
        } catch (error) {
            console.error('[InstallCommand] Не удалось скопировать команду', error);
        }
    };

    return (
        <Root {...rest}>
            {label && <StyledLabel>{label}</StyledLabel>}
            <StyledCommand>
                <StyledCommandText title={command}>{command}</StyledCommandText>
                <StyledCopyButton onClick={onCopy}>
                    {copied ? 'Скопировано' : 'Скопировать'}
                    {copied ? <IconDone color="inherit" size="xs" /> : <IconCopyOutline color="inherit" size="xs" />}
                </StyledCopyButton>
            </StyledCommand>
        </Root>
    );
};
