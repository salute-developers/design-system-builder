import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import type { Page, Request, Response } from '@playwright/test';
import { PendingMutation } from './pending-mutation.ts';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, resolve, reject };
}

function response(body: Promise<Error | null> = Promise.resolve(null)): Response {
    return { status: () => 200, finished: () => body, request: () => ({}) as Request } as Response;
}

function subject(responses: Promise<Response>[] = []) {
    const context = Object.assign(new EventEmitter(), { close: async () => {} });
    const page = {
        context: () => context,
        waitForResponse: () => {
            const next = responses.shift();
            assert(next, 'Все ожидаемые ответы заданы явно');
            return next;
        },
    } as unknown as Page;
    const guard = new PendingMutation(page);
    guard.watchBrowserWrites('http://localhost:8080/', 'own-project');
    const send = (result: Promise<Response | null>) => context.emit('request', browserWrite(result));
    return { context, guard, send };
}

function browserWrite(result: Promise<Response | null>): Request {
    return {
        url: () => 'http://localhost:8080/api/projects/own-project/ds/tenants/own-theme/token-values',
        method: () => 'PUT',
        response: () => result,
    } as Request;
}

test('без мутаций очистка закрывает контекст браузера', async (testContext) => {
    const { context, guard } = subject();
    const close = testContext.mock.method(context, 'close');
    await guard.waitBeforeCleanup('own-system');
    assert.equal(close.mock.callCount(), 1);
});

test('две записи: закрытие ждёт оба тела, даже если второе завершилось первым', async (testContext) => {
    const first = deferred<Error | null>();
    const second = deferred<Error | null>();
    const { context, guard, send } = subject();
    const close = testContext.mock.method(context, 'close');
    send(Promise.resolve(response(first.promise)));
    send(Promise.resolve(response(second.promise)));
    const cleanup = guard.waitBeforeCleanup('own-system');
    second.resolve(null);
    await setImmediate();
    assert.equal(close.mock.callCount(), 0);
    first.resolve(null);
    await cleanup;
    assert.equal(close.mock.callCount(), 1);
});

test('ожидание ответа UI сохраняет лимит, а отправленная запись учитывается один раз', async (testContext) => {
    testContext.mock.timers.enable({ apis: ['setTimeout'] });
    const late = deferred<Response>();
    const { guard, send } = subject([late.promise]);
    const failed = assert.rejects(
        guard.run(
            () => true,
            async () => {
                send(late.promise);
            },
            'Late',
        ),
        /15000 ms/u,
    );
    await setImmediate();
    testContext.mock.timers.tick(15_000);
    await failed;
    const completed = response();
    const finished = testContext.mock.method(completed, 'finished');
    late.resolve(completed);
    await guard.waitBeforeCleanup('own-system');
    assert.equal(finished.mock.callCount(), 1);
});

test('ошибка действия сохраняется при подтверждённом ответе', async () => {
    const failure = new Error('click failed');
    const completed = Promise.resolve(response());
    const { guard, send } = subject([completed]);
    await assert.rejects(
        guard.run(
            () => true,
            async () => {
                send(completed);
                throw failure;
            },
            'Action',
        ),
        (error) => error === failure,
    );
    await guard.waitBeforeCleanup('own-system');
});

test('ошибки действия и ответа сохраняются вместе; неизвестный исход запрещает DELETE', async () => {
    const actionError = new Error('click failed');
    const networkError = new Error('response lost');
    const { guard, send } = subject([Promise.reject(networkError)]);
    await assert.rejects(
        guard.run(
            () => true,
            async () => {
                send(Promise.resolve(null));
                throw actionError;
            },
            'Both',
        ),
        (error) => {
            assert(error instanceof AggregateError);
            assert.deepEqual(error.errors, [networkError, actionError]);
            return true;
        },
    );
    await assert.rejects(guard.waitBeforeCleanup('own-system'), /DELETE ДС own-system пропущен/u);
});

test('два незавершённых тела ограничены общими 60s', async (testContext) => {
    testContext.mock.timers.enable({ apis: ['setTimeout'] });
    const never = new Promise<Error | null>(() => {});
    const { guard, send } = subject();
    send(Promise.resolve(response(never)));
    send(Promise.resolve(response(never)));
    const failed = assert.rejects(guard.waitBeforeCleanup('own-system'), /DELETE ДС own-system пропущен/u);
    testContext.mock.timers.tick(60_000);
    await failed;
});

test('ошибка завершения одного тела запрещает очистку при успешной второй записи', async () => {
    const { guard, send } = subject();
    send(Promise.resolve(response(Promise.resolve(new Error('body lost')))));
    send(Promise.resolve(response()));
    await assert.rejects(guard.waitBeforeCleanup('own-system'), /DELETE ДС own-system пропущен/u);
});

function apiSession(guard: PendingMutation): Session {
    return {
        accessToken: 'unit-test',
        subject: 'unit-test',
        admin: false,
        storageState: { cookies: [], origins: [] },
        close: async () => {},
        trackWrite: (send) => guard.trackApi(send),
    };
}

const writeURL = 'http://localhost/api/own-system';

test('очистка ждёт тело API-записи подготовки', async (context) => {
    const { guard } = subject();
    const body = deferred<void>();
    context.mock.method(
        globalThis,
        'fetch',
        async () =>
            new globalThis.Response(
                new ReadableStream({
                    async start(controller) {
                        await body.promise;
                        controller.enqueue(new TextEncoder().encode('{}'));
                        controller.close();
                    },
                }),
            ),
    );
    const written = authenticatedRequest(apiSession(guard), writeURL, 'PUT', [200], {});
    let cleaned = false;
    const cleanup = guard.waitBeforeCleanup('own-system').then(() => {
        cleaned = true;
    });
    await setImmediate();
    assert.equal(cleaned, false);
    body.resolve();
    assert.deepEqual(await (await written).json(), {});
    await cleanup;
});

test('потеря тела API-ответа сохраняет ошибку записи и запрещает DELETE', async (context) => {
    const { guard } = subject();
    context.mock.method(
        globalThis,
        'fetch',
        async () =>
            new globalThis.Response(
                new ReadableStream({
                    start(controller) {
                        controller.error(new Error('body lost'));
                    },
                }),
            ),
    );
    await assert.rejects(authenticatedRequest(apiSession(guard), writeURL, 'POST', [200], {}), /сетевая ошибка/u);
    await assert.rejects(guard.waitBeforeCleanup('own-system'), /DELETE ДС own-system пропущен/u);
});

test('полный HTTP-отказ подтверждает завершение API-записи', async (context) => {
    const { guard } = subject();
    context.mock.method(globalThis, 'fetch', async () => new globalThis.Response('{}', { status: 409 }));
    await assert.rejects(authenticatedRequest(apiSession(guard), writeURL, 'PATCH', [200], {}), /HTTP 409/u);
    await guard.waitBeforeCleanup('own-system');
});

test('после начала очистки API-запись не отправляется', async (context) => {
    const { guard } = subject();
    const fetch = context.mock.method(globalThis, 'fetch', async () => new globalThis.Response('{}'));
    await guard.waitBeforeCleanup('own-system');
    await assert.rejects(authenticatedRequest(apiSession(guard), writeURL, 'PUT', [200], {}), /после начала очистки/u);
    assert.equal(fetch.mock.callCount(), 0);
});

test('повторный запрос браузера учитывается отдельно от успешной первой записи', async () => {
    const { guard, send } = subject();
    send(Promise.resolve(response()));
    send(Promise.resolve(null));
    await assert.rejects(guard.waitBeforeCleanup('own-system'), /DELETE ДС own-system пропущен/u);
});

test('очистка ждёт закрытие контекста и подтверждение записи, начавшейся во время закрытия', async (testContext) => {
    const { context, guard, send } = subject();
    const closing = deferred<void>();
    const late = deferred<Response | null>();
    const close = testContext.mock.method(context, 'close', async () => {
        send(late.promise);
        await closing.promise;
    });
    let canDelete = false;
    const cleanup = guard.waitBeforeCleanup('own-system').then(() => {
        canDelete = true;
    });
    await setImmediate();
    assert.equal(close.mock.callCount(), 1);
    assert.equal(canDelete, false);
    closing.resolve();
    await setImmediate();
    assert.equal(canDelete, false);
    late.resolve(response());
    await cleanup;
    assert.equal(canDelete, true);
});

test('запись без подтверждения во время закрытия запрещает DELETE', async (testContext) => {
    const { context, guard, send } = subject();
    testContext.mock.method(context, 'close', async () => {
        send(Promise.resolve(null));
    });
    await assert.rejects(guard.waitBeforeCleanup('own-system'), /DELETE ДС own-system пропущен/u);
});

test('ошибка закрытия контекста запрещает DELETE', async (testContext) => {
    const { context, guard } = subject();
    testContext.mock.method(context, 'close', async () => {
        throw new Error('close failed');
    });
    await assert.rejects(guard.waitBeforeCleanup('own-system'), /закрытие контекста браузера не подтверждено/u);
});
