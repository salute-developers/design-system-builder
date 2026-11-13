import { useEffect, useState } from 'react';
import styled from 'styled-components';

const Box = styled.span<{ $size: number }>`
    display: inline-block;
    flex: none;
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
`;

const Mask = styled(Box)<{ $url: string }>`
    background-color: currentColor;
    -webkit-mask: url('${({ $url }) => $url}') center / contain no-repeat;
    mask: url('${({ $url }) => $url}') center / contain no-repeat;
`;

const Placeholder = styled(Box)`
    border: 1px dashed currentColor;
    border-radius: 4px;
    opacity: 0.35;
    box-sizing: border-box;
`;

/**
 * Рисует иконку из SVG билдера цветом текста (CSS-маска). Если файл не загрузился, показывает нейтральную заглушку.
 * Загрузку проверяет скрытое изображение: маска сама об ошибке не сообщает.
 */
export const IconMask = ({ url, size }: { url: string; size: number }) => {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
        const image = new Image();
        image.onerror = () => setFailed(true);
        image.src = url;
        return () => {
            image.onerror = null;
        };
    }, [url]);

    if (failed) return <Placeholder $size={size} data-testid="icon-placeholder" aria-hidden="true" />;
    return <Mask $size={size} $url={url} data-testid="icon-mask" aria-hidden="true" />;
};
