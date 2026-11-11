import type { ComponentProps, ForwardRefExoticComponent } from 'react';
import { composeMask } from '@salutejs/plasma-new-hope/styled-components';

import { TextField } from '../TextField';

// Обёртка Mask не выводится из данных: у маски нет своего конфига, это поле ввода TextField с маской.
// `component` ядра возвращает forwardRef, но типизирован как FunctionComponent; composeMask ждёт forwardRef.
export const Mask = composeMask(TextField as ForwardRefExoticComponent<ComponentProps<typeof TextField>>);
