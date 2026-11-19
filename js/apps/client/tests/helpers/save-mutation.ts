import { expect, type Response } from '@playwright/test';
import type { PendingMutation } from './pending-mutation.ts';

/** Подписка до UI-действия, точные метод и адрес, подтверждённое завершение ответа. */
export async function saveMutation(
    mutation: PendingMutation,
    url: string,
    method: string,
    action: () => Promise<unknown>,
    status = 200,
): Promise<Response> {
    const endpoint = new URL(url);
    const response = await mutation.run(
        (response) => {
            const actual = new URL(response.url());
            return (
                response.request().method() === method &&
                actual.origin === endpoint.origin &&
                actual.pathname === endpoint.pathname
            );
        },
        async () => {
            await action();
        },
        'Сохранение изменения через UI',
        10_000,
    );
    expect(response.status()).toBe(status);
    return response;
}
