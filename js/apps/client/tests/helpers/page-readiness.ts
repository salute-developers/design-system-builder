import type { Locator, Response, Page, Request, TestInfo } from '@playwright/test';

/** Фиксирует состояние загрузки при исходной ошибке; не повторяет запросы и действия UI. */
export class PageReadiness {
    private readonly pending = new Map<Request, number>();
    private readonly failures: Array<{ path: string; error: string; elapsedMs: number; at: number }> = [];
    private reported = false;
    private readonly page: Page;
    private readonly info: TestInfo;

    constructor(page: Page, info: TestInfo) {
        this.page = page;
        this.info = info;
        page.on('request', this.started);
        page.on('requestfinished', this.finished);
        page.on('response', this.responded);
        page.on('requestfailed', this.failed);
    }

    private readonly started = (request: Request) => {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'GET' && path.startsWith('/api/') && !path.endsWith('/events')) {
            this.pending.set(request, performance.now());
        }
    };

    private readonly finished = (request: Request) => {
        this.pending.delete(request);
    };

    private readonly failed = (request: Request) => {
        const started = this.pending.get(request);
        if (started === undefined) return;
        this.pending.delete(request);
        const error = request.failure()?.errorText ?? '';
        this.failures.push({
            path: new URL(request.url()).pathname,
            error: /^net::ERR_[A-Z_]+$/u.test(error) ? error : 'NETWORK_ERROR',
            elapsedMs: Math.round(performance.now() - started),
            at: performance.now(),
        });
        if (this.failures.length > 10) this.failures.shift();
    };

    private readonly responded = (response: Response) => {
        const request = response.request();
        const started = this.pending.get(request);
        if (started === undefined || response.status() < 400) return;
        this.failures.push({
            path: new URL(response.url()).pathname,
            error: 'HTTP ' + response.status(),
            elapsedMs: Math.round(performance.now() - started),
            at: performance.now(),
        });
        if (this.failures.length > 10) this.failures.shift();
    };

    async waitFor(
        label: string,
        locator: Locator,
        options: Readonly<{ timeout: number; state?: 'visible' | 'hidden' }>,
    ): Promise<void> {
        await this.run(label, () => locator.waitFor({ state: 'visible', ...options }));
    }

    async run(label: string, action: () => Promise<void>): Promise<void> {
        try {
            await action();
        } catch (error) {
            await this.report(label);
            throw error;
        }
    }

    async report(label: string): Promise<void> {
        if (this.reported) return;
        this.reported = true;
        try {
            const state = {
                stage: label,
                path: new URL(this.page.url()).pathname,
                loading: await this.page
                    .getByRole('status')
                    .evaluateAll((nodes) =>
                        nodes.map((node) => node.getAttribute('aria-label') || node.textContent?.trim() || ''),
                    )
                    .catch(() => []),
                alerts: await this.page
                    .getByRole('alert')
                    .allTextContents()
                    .catch(() => []),
                pendingReads: [...this.pending].map(([request, started]) => ({
                    path: new URL(request.url()).pathname,
                    elapsedMs: Math.round(performance.now() - started),
                })),
                failedReads: this.failures.map(({ at: _at, ...read }) => read),
            };
            await this.info.attach('page-readiness', {
                body: JSON.stringify(state, null, 2),
                contentType: 'application/json',
            });
            console.warn(
                '[e2e:page] ' +
                    label +
                    '; незавершённых GET=' +
                    state.pendingReads.length +
                    '; ошибок GET=' +
                    state.failedReads.length +
                    '; см. page-readiness.',
            );
        } catch {
            console.warn('[e2e:page] ' + label + '; диагностика недоступна; исходная ошибка сохранена.');
        }
    }

    dispose(): void {
        this.page.off('request', this.started);
        this.page.off('requestfinished', this.finished);
        this.page.off('response', this.responded);
        this.page.off('requestfailed', this.failed);
        this.pending.clear();
    }
}
