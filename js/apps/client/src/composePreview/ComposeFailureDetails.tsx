import { useState } from 'react';

import { copyText } from '../utils/copyText';

import type { PreviewFailureDetails } from './types';
import {
    FailureDetailsBody,
    FailureDetailsCopy,
    FailureDetailsHeader,
    FailureDetailsRoot,
    FailureDetailsStatus,
    FailureDetailsText,
} from './ComposePreviewFrame.styles';

interface ComposeFailureDetailsProps {
    details: PreviewFailureDetails;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** Причина сбоя одним текстом: запись консоли плагина и stack исключения. */
export const formatFailureDetails = ({ consoleError, stack }: PreviewFailureDetails) =>
    [consoleError && `console.error: ${consoleError}`, stack].filter(Boolean).join('\n\n');

/**
 * Отладочный блок «Причина» под сбоем плагина: stack и консольная ошибка, которые плагин передал в `details`.
 * Родитель решает, когда его показывать (в debug-режиме).
 */
export const ComposeFailureDetails = ({ details }: ComposeFailureDetailsProps) => {
    const [expanded, setExpanded] = useState(false);
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const text = formatFailureDetails(details);

    const onCopy = () => {
        copyText(text).then(
            () => {
                setCopyState('copied');
                setTimeout(() => setCopyState('idle'), 2000);
            },
            () => setCopyState('failed'),
        );
    };

    return (
        <FailureDetailsRoot data-testid="compose-failure-details">
            <FailureDetailsHeader>
                <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
                    {expanded ? '▾' : '▸'} Причина
                </button>
                <FailureDetailsCopy type="button" onClick={onCopy}>
                    Копировать
                </FailureDetailsCopy>
                {copyState === 'copied' && <FailureDetailsStatus role="status">Скопировано</FailureDetailsStatus>}
                {copyState === 'failed' && <FailureDetailsStatus role="alert">Не удалось скопировать</FailureDetailsStatus>}
            </FailureDetailsHeader>
            {expanded && (
                <FailureDetailsBody>
                    <FailureDetailsText data-testid="compose-failure-details-text">{text}</FailureDetailsText>
                </FailureDetailsBody>
            )}
        </FailureDetailsRoot>
    );
};
