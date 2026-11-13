import { test as base, expect } from './colors.ts';
import { SizesPage } from '../pages/sizes.page.ts';

export const test = base.extend<{ sizes: SizesPage }>({
    sizes: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new SizesPage(page, editorURL.replace(/\/colors$/u, '/shapes'), pageReadiness));
    },
});

export { expect };
