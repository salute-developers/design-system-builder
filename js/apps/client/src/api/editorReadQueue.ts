import { CanceledError } from 'axios';

type WaitingRead = {
    signal: AbortSignal;
    background: boolean;
    queuedAt: number;
    start: () => void;
    cancel: () => void;
};

/** Общая очередь чтений: четыре запроса одновременно, запас для открытия редактора. */
export class EditorReadQueue {
    private active = 0;
    private allowance = 16;
    private refilledAt = Date.now();
    private waiting: WaitingRead[] = [];
    private timer?: ReturnType<typeof setTimeout>;

    acquire(signal: AbortSignal, background: boolean): Promise<() => void> {
        if (signal.aborted) return Promise.reject(new CanceledError());
        return new Promise((resolve, reject) => {
            const entry: WaitingRead = {
                signal,
                background,
                queuedAt: Date.now(),
                start: () => {
                    signal.removeEventListener('abort', entry.cancel);
                    this.active++;
                    let released = false;
                    resolve(() => {
                        if (released) return;
                        released = true;
                        this.active--;
                        this.drain();
                    });
                },
                cancel: () => {
                    signal.removeEventListener('abort', entry.cancel);
                    this.waiting = this.waiting.filter((item) => item !== entry);
                    reject(new CanceledError());
                    this.drain();
                },
            };
            this.waiting.push(entry);
            signal.addEventListener('abort', entry.cancel, { once: true });
            this.drain();
        });
    }

    reset() {
        // Активные запросы освободят собственные места в finally после отмены сессии.
        for (const entry of [...this.waiting]) entry.cancel();
        this.allowance = 16;
        this.refilledAt = Date.now();
        clearTimeout(this.timer);
        this.timer = undefined;
    }

    private drain() {
        clearTimeout(this.timer);
        this.timer = undefined;
        const now = Date.now();
        // Клиентский бюджет 8 стартов/с сглаживает поток; наличие rate limit у внешнего прокси не предполагается.
        this.allowance = Math.min(16, this.allowance + Math.max(0, now - this.refilledAt) / 125);
        this.refilledAt = now;
        const available = Math.min(4 - this.active, this.waiting.length, Math.floor(this.allowance));
        for (let started = 0; started < available; started++) {
            const foreground = this.waiting.findIndex((entry) => !entry.background || now - entry.queuedAt >= 1_000);
            const [entry] = this.waiting.splice(Math.max(0, foreground), 1);
            this.allowance--;
            entry.start();
        }
        if (this.waiting.length && this.active < 4)
            this.timer = setTimeout(() => this.drain(), Math.ceil((1 - this.allowance) * 125));
    }
}
