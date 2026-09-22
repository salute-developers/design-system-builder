import type { FC } from 'react';
import { stepsConfig as rawStepsConfig, component, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';
import type { StepItemExtendedProps } from '@salutejs/plasma-new-hope';

import { StepItem } from './StepItem';
import { config } from './Steps.config';

// Обёртка Steps не выводится из данных: базовый конфиг ядра — фабрика, которой нужен
// уже собранный StepItem (дочерний компонент из этой же папки).
const stepsConfig = rawStepsConfig(StepItem as FC<StepItemExtendedProps>);

const mergedConfig = mergeConfig(stepsConfig, config);

export const Steps = component(mergedConfig);
