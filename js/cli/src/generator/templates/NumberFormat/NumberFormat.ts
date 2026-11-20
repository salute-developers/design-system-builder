import type { ComponentProps, ForwardRefExoticComponent } from 'react';
import { composeNumberFormat } from '@salutejs/plasma-new-hope/styled-components';
import type { CustomNumberFormatProps } from '@salutejs/plasma-new-hope';

import { TextField } from '../TextField';

// Обёртка NumberFormat не выводится из данных: своего конфига нет, это TextField с форматированием числа.
// `component` ядра возвращает forwardRef, но типизирован как FunctionComponent; composeNumberFormat ждёт forwardRef.
// Тип результата задан явно: выводимый тип ссылается на react-number-format внутри ядра и не переносится.
type NumberFormatProps = CustomNumberFormatProps & ComponentProps<typeof TextField>;

export const NumberFormat = composeNumberFormat(
    TextField as ForwardRefExoticComponent<ComponentProps<typeof TextField>>,
) as ForwardRefExoticComponent<NumberFormatProps>;
