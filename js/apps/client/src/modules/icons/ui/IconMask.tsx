import { useEffect } from 'react';
import styled from 'styled-components';

import { setIconFailed, useFailedIconUrls } from '../application/iconLoadFailures';

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
 * Рисует иконку из SVG билдера цветом текста (CSS-маска). Если файл не загрузился, показывает нейтральную заглушку
 * с названием и помечает адрес недоступным (`iconLoadFailures`), чтобы пикер и панель сведений могли сообщить причину.
 * Загрузку проверяет скрытое изображение: маска сама об ошибке не сообщает.
 */
export const IconMask = ({ url, size }: { url: string; size: number }) => {
    const failed = useFailedIconUrls().has(url);

    useEffect(() => {
        const image = new Image();
        image.onerror = () => setIconFailed(url, true);
        image.onload = () => setIconFailed(url, false);
        image.src = url;
        return () => {
            image.onerror = null;
            image.onload = null;
        };
    }, [url]);

    if (failed) {
        return (
            <Placeholder
                $size={size}
                data-testid="icon-placeholder"
                role="img"
                aria-label="Не удалось загрузить иконку"
            />
        );
    }
    return <Mask $size={size} $url={url} data-testid="icon-mask" aria-hidden="true" />;
};
