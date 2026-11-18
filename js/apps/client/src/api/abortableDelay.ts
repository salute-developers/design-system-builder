import { CanceledError, type AxiosRequestConfig } from 'axios';

/** Общее ожидание очереди и HTTP-повторов: отмена снимает таймер и собственную подписку. */
export const abortableDelay = (milliseconds: number, signal: AxiosRequestConfig['signal']) =>
    new Promise<void>((resolve, reject) => {
        const finish = () => signal?.removeEventListener?.('abort', cancel);
        const cancel = () => {
            clearTimeout(timer);
            finish();
            reject(new CanceledError());
        };
        const timer = setTimeout(() => {
            finish();
            resolve();
        }, milliseconds);
        signal?.addEventListener?.('abort', cancel, { once: true });
        if (signal?.aborted) cancel();
    });
