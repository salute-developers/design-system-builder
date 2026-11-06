import type { Page, Response } from '@playwright/test';

type Completion = Readonly<{ status: number; elapsedMs: number }> | undefined;

function within<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), milliseconds);
        operation.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/** Отделяет лимит ответа UI от подтверждения завершения мутации перед удалением её ДС. */
export class PendingMutation {
    private completion?: Promise<Completion>;
    private readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async run(
        matches: (response: Response) => boolean,
        action: () => Promise<void>,
        label: string,
        responseTimeoutMs = 15_000,
    ): Promise<Response> {
        const observed = this.observe(matches, responseTimeoutMs, label);
        const outcomes = await Promise.allSettled([observed, Promise.resolve().then(action)]);
        const failures = outcomes.filter((outcome) => outcome.status === 'rejected').map((outcome) => outcome.reason);
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1) {
            const details = failures.map((error: unknown) =>
                error instanceof Error ? error.message : 'Неизвестная ошибка',
            );
            throw new AggregateError(
                failures,
                `${label}: действие и ожидание ответа завершились ошибками.
${details.join('\n')}`,
            );
        }
        const response = outcomes[0];
        if (response?.status !== 'fulfilled') throw new Error('Ответ мутации не подтверждён.');
        return response.value;
    }

    private observe(
        matches: (response: Response) => boolean,
        responseTimeoutMs: number,
        label: string,
    ): Promise<Response> {
        if (this.completion) throw new Error('Ожидание мутации уже зарегистрировано.');
        const started = performance.now();
        const response = this.page.waitForResponse(matches, { timeout: 60_000 });
        const finished = response.then(async (value) => {
            const failure = await value.finished();
            if (failure) throw new Error('Завершение тела ответа мутации не подтверждено.');
            return { status: value.status(), elapsedMs: Math.round(performance.now() - started) };
        });
        this.completion = within(finished, 60_000, 'Завершение мутации не подтверждено за 60 секунд.').then(
            (value) => value,
            () => undefined,
        );
        return within(
            response,
            responseTimeoutMs,
            `${label}: ответ не получен за ${responseTimeoutMs} ms; очистка отдельно дождётся завершения запроса.`,
        );
    }

    async waitBeforeCleanup(systemId: string): Promise<void> {
        if (!this.completion) return;
        const result = await this.completion;
        if (!result) {
            throw new Error(
                `DELETE ДС ${systemId} пропущен: результат мутации не подтверждён; автоматический повтор отсутствует.`,
            );
        }
        console.info(`[e2e:mutation] Мутация завершена перед DELETE; HTTP ${result.status}; ${result.elapsedMs} ms.`);
    }
}
