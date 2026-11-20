import type { Page, Request, TestInfo } from '@playwright/test';

/** Фиксирует состояние загрузки при исходной ошибке; не повторяет запросы и действия UI. */
export class PageReadiness {
    private readonly pending = new Map<Request, number>();
    private readonly failures: Array<{ path: string; error: string }> = [];
    private readonly page: Page;
    private readonly info: TestInfo;

    constructor(page: Page, info: TestInfo) {
        this.page = page;
        this.info = info;
        page.on('request', this.started);
        page.on('requestfinished', this.finished);
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
        if (!this.pending.delete(request)) return;
        const error = request.failure()?.errorText ?? '';
        this.failures.push({
            path: new URL(request.url()).pathname,
            error: /^net::ERR_[A-Z_]+$/u.test(error) ? error : 'NETWORK_ERROR',
        });
        if (this.failures.length > 10) this.failures.shift();
    };

    async run(label: string, action: () => Promise<void>): Promise<void> {
        try {
            await action();
        } catch (error) {
            try {
                const state = {
                    stage: label,
                    path: new URL(this.page.url()).pathname,
                    loading: await this.page
                        .getByRole('status')
                        .evaluateAll((nodes) =>
                            nodes.map((node) => node.getAttribute('aria-label') || node.textContent?.trim() || ''),
                        ),
                    alerts: await this.page.getByRole('alert').allTextContents(),
                    pendingReads: [...this.pending].map(([request, started]) => ({
                        path: new URL(request.url()).pathname,
                        elapsedMs: Math.round(performance.now() - started),
                    })),
                    failedReads: [...this.failures],
                };
                await this.info.attach('page-readiness', {
                    body: JSON.stringify(state, null, 2),
                    contentType: 'application/json',
                });
                console.warn(
                    `[e2e:page] ${label}; загрузка=${state.loading.join(', ') || 'нет'}; незавершённых GET=${state.pendingReads.length}; см. page-readiness.`,
                );
            } catch {
                console.warn(`[e2e:page] ${label}; состояние страницы недоступно; исходная ошибка сохранена.`);
            }
            throw error;
        }
    }

    dispose(): void {
        this.page.off('request', this.started);
        this.page.off('requestfinished', this.finished);
        this.page.off('requestfailed', this.failed);
        this.pending.clear();
    }
}
