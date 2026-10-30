import styled from 'styled-components';

/**
 * Слой с iframe плагина. Стоит в стабильном узле страницы и позиционируется над областью превью; скрытый слой
 * прозрачен и не принимает события, но не скрывается через `display`/`visibility`: браузер мог бы притормозить
 * невидимый iframe, а плагину нужно продолжать загрузку.
 */
export const HostLayer = styled.div<{ $visible: boolean }>`
    position: fixed;
    top: 0;
    left: 0;
    width: 22.5rem;
    height: 20.75rem;
    overflow: hidden;

    opacity: ${({ $visible }) => ($visible ? 1 : 0)};
    pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
`;

/** Область превью, над которой хост показывает iframe. */
export const SlotRoot = styled.div`
    width: 100%;
    height: 100%;
    min-height: 20.75rem;
`;
