import type { Page, Locator } from '@playwright/test';
import { TypographyPage } from './typography.page.ts';
import type { PageReadiness } from '../helpers/page-readiness.ts';
import { sectionReadyTimeoutMs } from '../config/timeouts.ts';

export class ViewerTypographyPage extends TypographyPage {
    private readonly browserPage: Page;
    private readonly targetURL: string;
    private readonly readiness: PageReadiness;
    readonly tree: Locator;
    readonly inspector: Locator;
    readonly readOnly: Locator;
    readonly iosSize: Locator;
    readonly bodyMRow: Locator;
    readonly mutationControls: Locator;

    constructor(browserPage: Page, targetURL: string, readiness: PageReadiness) {
        super(browserPage);
        this.browserPage = browserPage;
        this.targetURL = targetURL;
        this.readiness = readiness;
        this.tree = browserPage.locator('.typography-tree');
        this.inspector = browserPage.locator('.typography-inspector');
        this.readOnly = this.inspector.getByText('Только просмотр', { exact: true });
        this.iosSize = this.inspector.getByRole('textbox', { name: 'Size iOS', exact: true });
        this.bodyMRow = this.tree.locator('button[data-style-key="body.m"]');
        this.mutationControls = this.tree.or(this.inspector).getByRole('button', {
            name: /^(Создать|Добавить|Удалить|Переименовать|Убрать своё значение|Своё значение платформы)/u,
        });
    }

    async open(): Promise<void> {
        await this.readiness.run('Открытие типографики Viewer', async () => {
            await this.browserPage.goto(this.targetURL);
            await this.readiness.waitFor('Типографика: готовность экрана', this.bodyM, {
                timeout: sectionReadyTimeoutMs,
            });
        });
    }
}
