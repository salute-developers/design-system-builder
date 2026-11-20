import { expect } from '@playwright/test';
import type { Response } from '@playwright/test';
import type { PendingMutation } from '../helpers/pending-mutation.ts';
import type { ColorEditorPage } from '../pages/color-editor.page.ts';

/** Один UI-ввод: реальный ответ и конечный индикатор в общем лимите кейса. */
export class ColorTokenSteps {
    private readonly editor: ColorEditorPage;
    private readonly mutations: PendingMutation;

    constructor(editor: ColorEditorPage, mutations: PendingMutation) {
        this.editor = editor;
        this.mutations = mutations;
    }

    async saveLight(hex: string, valuesURL: string): Promise<Response> {
        await this.editor.editLight(hex);
        return this.save(valuesURL, () => this.editor.confirmLight(), hex.replace('#', ''));
    }

    async selectLibraryStep(name: string, step: number, hex: string, valuesURL: string): Promise<Response> {
        return this.save(
            valuesURL,
            async () => {
                await this.editor.libraryStep(name, step, hex).click();
                await this.editor.closePicker();
            },
            name + ' ' + step,
        );
    }

    private async save(valuesURL: string, action: () => Promise<void>, expectedValue: string): Promise<Response> {
        const expected = new URL(valuesURL);
        const started = performance.now();
        const saving = expect(this.editor.saving).toBeVisible();
        const mutation = this.mutations.run(
            (response) => {
                const actual = new URL(response.url());
                return (
                    response.request().method() === 'PUT' &&
                    actual.origin === expected.origin &&
                    actual.pathname === expected.pathname
                );
            },
            action,
            'Автосохранение цветового токена',
            10_000,
        );
        const outcomes = await Promise.allSettled([mutation, saving]);
        const failures = outcomes.filter((outcome) => outcome.status === 'rejected').map((outcome) => outcome.reason);
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1) throw new AggregateError(failures, 'Не подтверждены ответ и индикатор сохранения.');
        const result = outcomes[0];
        if (result?.status !== 'fulfilled') throw new Error('Ответ PUT не подтверждён.');
        expect(result.value.status()).toBe(200);
        await expect(this.editor.saved).toBeVisible({ timeout: Math.max(1, 10_000 - (performance.now() - started)) });
        expect(performance.now() - started, 'Полное подтверждение сохранения не дольше 10 секунд').toBeLessThanOrEqual(
            10_000,
        );
        await expect(this.editor.light).toHaveValue(expectedValue);
        return result.value;
    }
}
