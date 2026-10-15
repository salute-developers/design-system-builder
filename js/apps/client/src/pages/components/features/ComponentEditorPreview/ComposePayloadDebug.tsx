import { useEffect, useMemo, useState } from 'react';

import { BasicButton } from '../../../../components';
import type { PreviewPayloadInput } from '../../../../composePreview';

import {
    StyledPayloadCount,
    StyledPayloadDebug,
    StyledPayloadHeader,
    StyledPayloadJson,
    StyledPayloadStatus,
    StyledPayloadToggle,
} from './ComponentEditorPreview.styles';

interface ComposePayloadDebugProps {
    payload: PreviewPayloadInput;
}

type CopyState = 'idle' | 'copied' | 'failed';

const format = (payload: PreviewPayloadInput) => JSON.stringify(payload, null, 2);

/** Clipboard API есть только в безопасном контексте; запасной путь — временный `textarea`. */
const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);

    if (!copied) throw new Error('Copy is not available');
};

/**
 * Отладочный блок под Compose-превью: JSON последнего собранного payload (без `requestId`, его добавляет сессия при
 * отправке). Показывается только в debug-режиме; форматирование откладывается до разворачивания блока.
 */
export const ComposePayloadDebug = ({ payload }: ComposePayloadDebugProps) => {
    const [expanded, setExpanded] = useState(false);
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const json = useMemo(() => (expanded ? format(payload) : ''), [expanded, payload]);
    // Сколько раз собран новый payload (смена объекта, а не содержимого: по ней `ComposePreviewFrame` шлёт его в плагин).
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount((value) => value + 1);
    }, [payload]);

    const onCopy = () => {
        copyText(format(payload)).then(
            () => {
                setCopyState('copied');
                setTimeout(() => setCopyState('idle'), 2000);
            },
            () => setCopyState('failed'),
        );
    };

    return (
        <StyledPayloadDebug data-testid="compose-payload-debug">
            <StyledPayloadHeader>
                <StyledPayloadToggle type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
                    {expanded ? '▾' : '▸'} Payload
                    <StyledPayloadCount title="Сколько раз собран новый payload с момента открытия блока" data-testid="compose-payload-count">
                        {count}
                    </StyledPayloadCount>
                </StyledPayloadToggle>
                <BasicButton text="Копировать" size="m" role="button" onClick={onCopy} />
                {copyState === 'copied' && <StyledPayloadStatus role="status">Скопировано</StyledPayloadStatus>}
                {copyState === 'failed' && <StyledPayloadStatus role="alert">Не удалось скопировать</StyledPayloadStatus>}
            </StyledPayloadHeader>
            {expanded && <StyledPayloadJson data-testid="compose-payload-json">{json}</StyledPayloadJson>}
        </StyledPayloadDebug>
    );
};
