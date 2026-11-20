import { css, component, mergeConfig, viewContainerConfig } from '@salutejs/plasma-new-hope/styled-components';

import { viewContainer } from '../../theme';

// Обёртка ViewContainer не выводится из данных: вид onDark/onLight подставляет наборы переменных темы пакета
// (`viewContainer` генератора темы), как sdds-serv из sdds-themes. Поэтому компонент генерируется только вместе с темой.
const config = {
    variations: {
        view: {
            onDark: css`
                ${viewContainer.dark}
            `,
            onLight: css`
                ${viewContainer.light}
            `,
        },
    },
};

/**
 * Контейнер, внутри которого компоненты используют цвета тёмной или светлой темы.
 */
export const ViewContainer = component(mergeConfig(viewContainerConfig, config));
