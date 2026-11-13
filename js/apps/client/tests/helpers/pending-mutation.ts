import type { Page, Request, Response as BrowserResponse } from '@playwright/test';

type FinishedWrite = Readonly<{ status: number; elapsedMs: number }>;
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function finishBrowserWrite(response: BrowserResponse | null, started: number): Promise<FinishedWrite> {
    if (!response || (await response.finished())) {
        throw new Error('Завершение тела ответа мутации не подтверждено.');
    }
    return { status: response.status(), elapsedMs: Math.round(performance.now() - started) };
}

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
    private readonly completions: Promise<FinishedWrite>[] = [];
    private readonly page: Page;
    private cleanupStarted = false;

    constructor(page: Page) {
        this.page = page;
    }

    watchBrowserWrites(gatewayBaseURL: string, projectId: string): () => void {
        const scope = new URL(`api/projects/${encodeURIComponent(projectId)}/ds/`, gatewayBaseURL);
        const onRequest = (request: Request) => {
            if (!writeMethods.has(request.method())) return;
            const url = new URL(request.url());
            if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
            const started = performance.now();
            const finished = request.response().then((response) => finishBrowserWrite(response, started));
            this.remember(finished);
        };
        const context = this.page.context();
        context.on('request', onRequest);
        return () => context.off('request', onRequest);
    }

    async run(
        matches: (response: BrowserResponse) => boolean,
        action: () => Promise<void>,
        label: string,
        responseTimeoutMs = 15_000,
    ): Promise<BrowserResponse> {
        this.requireOpen();
        const observed = within(
            this.page.waitForResponse(matches, { timeout: 60_000 }),
            responseTimeoutMs,
            `${label}: ответ не получен за ${responseTimeoutMs} ms; очистка отдельно проверит отправленные запросы.`,
        );
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

    /** send возвращает ответ после полного чтения тела под исходным таймаутом запроса. */
    trackApi(send: () => Promise<Response>): Promise<Response> {
        this.requireOpen();
        const started = performance.now();
        const response = Promise.resolve().then(send);
        this.remember(
            response.then((value) => ({
                status: value.status,
                elapsedMs: Math.round(performance.now() - started),
            })),
        );
        return response;
    }

    private requireOpen(): void {
        if (this.cleanupStarted) throw new Error('Запись запрещена после начала очистки ДС.');
    }

    private remember(finished: Promise<FinishedWrite>): void {
        // Запись может упасть до teardown. Сохраняем исходный Promise для барьера.
        void finished.catch(() => {});
        this.completions.push(finished);
    }

    async waitBeforeCleanup(systemId: string): Promise<void> {
        this.cleanupStarted = true;
        const message = `DELETE ДС ${systemId} пропущен: результат мутации не подтверждён.`;
        const deadline = performance.now() + 60_000;
        const remaining = () => Math.max(0, deadline - performance.now());
        const waitForWrites = (writes: Promise<FinishedWrite>[]) =>
            within(Promise.all(writes), remaining(), message).catch((cause: unknown) => {
                throw new Error(message, { cause });
            });
        const beforeClose = await waitForWrites(this.completions);

        // Контекст остаётся под наблюдением до закрытия, в том числе во время сбора артефактов Playwright.
        await within(this.page.context().close(), remaining(), message).catch((cause: unknown) => {
            throw new Error(`DELETE ДС ${systemId} пропущен: закрытие контекста браузера не подтверждено.`, { cause });
        });
        const duringClose = await waitForWrites(this.completions.slice(beforeClose.length));
        for (const result of [...beforeClose, ...duringClose]) {
            console.info(
                `[e2e:mutation] Мутация завершена перед DELETE; HTTP ${result.status}; ${result.elapsedMs} ms.`,
            );
        }
    }
}
