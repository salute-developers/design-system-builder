import type { FC } from 'react';
import {
    boundCalendar,
    calendarBaseConfig,
    component,
    mergeConfig,
    withRange,
} from '@salutejs/plasma-new-hope/styled-components';
import type { CalendarBaseProps, CalendarDoubleProps } from '@salutejs/plasma-new-hope/styled-components';

import { CalendarDouble } from '../CalendarDouble';

import { config } from './Calendar.config';

// Обёртка Calendar не выводится из данных: как в sdds-serv, Calendar выбирает между одинарным и двойным
// календарём и их вариантами с диапазоном; конфиг двойного календаря — свой компонент CalendarDouble.
export const CalendarBase = component(mergeConfig(calendarBaseConfig, config));

export const CalendarBaseRange = withRange<CalendarBaseProps>(CalendarBase as FC<CalendarBaseProps>);

export const CalendarDoubleRange = withRange<CalendarDoubleProps>(CalendarDouble as FC<CalendarDoubleProps>);

export const Calendar = boundCalendar({
    base: CalendarBase as FC<CalendarBaseProps>,
    baseRange: CalendarBaseRange,
    double: CalendarDouble as FC<CalendarDoubleProps>,
    doubleRange: CalendarDoubleRange,
});
