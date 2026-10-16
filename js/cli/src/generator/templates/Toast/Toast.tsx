import {
    toastConfig,
    ToastProviderHoc,
    ToastControllerHoc,
    component,
    mergeConfig,
} from '@salutejs/plasma-new-hope/styled-components';

import { config } from './Toast.config';

// Обёртка Toast не выводится из данных: поверх компонента ядро строит контроллер и провайдер.
const mergedConfig = mergeConfig(toastConfig, config);

export const Toast = component(mergedConfig);

export const ToastController = ToastControllerHoc(Toast);

export const ToastProvider = ToastProviderHoc(ToastController);
