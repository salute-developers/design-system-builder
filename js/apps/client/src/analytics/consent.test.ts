import { beforeEach, expect, it, vi } from 'vitest';
import { createAnalyticsConsent } from './consent';

const policy = { version: 'web-v1', sha256: 'a'.repeat(64), text: 'Короткое уведомление' };
const receipt = {
    revision: 1,
    decision: 'granted',
    policy_version: policy.version,
    policy_sha256: policy.sha256,
    received_at: '2026-11-10T00:00:00Z',
};
const response = (allowed = true, revision = 1) => ({
    policy,
    current: { revision, analytics_allowed: allowed, receipt },
    receipt,
});
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const saved = () => ({ key: 'b'.repeat(64), revision: 1, decision: 'granted', receipt });
beforeEach(() => localStorage.clear());

it('confirms saved permission exactly once per page lifetime', async () => {
    localStorage.setItem('test', JSON.stringify(saved()));
    const request = vi.fn().mockResolvedValue(ok(response()));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    expect(consent.getSnapshot().allowed).toBe(false);
    await consent.start();
    await consent.start();
    expect(consent.getSnapshot().allowed).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
});

it('keeps the saved decision but disables the entire launch when GET fails', async () => {
    localStorage.setItem('test', JSON.stringify(saved()));
    const request = vi.fn().mockRejectedValue(new Error('offline'));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    await consent.start();
    expect(consent.getSnapshot()).toMatchObject({ allowed: false, choice: 'granted' });
    expect(JSON.parse(localStorage.getItem('test')!).decision).toBe('granted');
    expect(request).toHaveBeenCalledTimes(1);
});

it('remembers denial without a GET', async () => {
    localStorage.setItem('test', JSON.stringify({ ...saved(), decision: 'denied' }));
    const request = vi.fn();
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    expect(consent.getSnapshot()).toMatchObject({ allowed: false, choice: 'denied' });
    expect(request).not.toHaveBeenCalled();
});

it('does not grant from an old GET after local withdrawal', async () => {
    localStorage.setItem('test', JSON.stringify(saved()));
    let resolve!: (value: Response) => void;
    const request = vi
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done;
                }),
        )
        .mockRejectedValue(new Error('offline'));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    const initial = consent.start();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await consent.choose('withdrawn');
    resolve(ok(response()));
    await initial;
    expect(consent.getSnapshot().allowed).toBe(false);
    expect(JSON.parse(localStorage.getItem('test')!)).toMatchObject({
        decision: 'withdrawn',
        pending: { decision: 'withdrawn' },
    });
});

it('records the displayed notice and enables only after the POST receipt', async () => {
    let finish!: (value: Response) => void;
    const request = vi
        .fn()
        .mockResolvedValueOnce(ok(response(false, 0)))
        .mockImplementationOnce(
            () =>
                new Promise((done) => {
                    finish = done;
                }),
        );
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    const choosing = consent.choose('granted');
    expect(consent.getSnapshot().allowed).toBe(false);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    finish(ok(response()));
    await choosing;
    expect(consent.getSnapshot().allowed).toBe(true);
    const body = JSON.parse(request.mock.calls[1][1].body);
    expect(body).toMatchObject({
        decision: 'granted',
        policy_version: policy.version,
        policy_sha256: policy.sha256,
        client_group: 'web',
    });
    expect(request).toHaveBeenCalledTimes(2);
});

it('applies a cross-tab withdrawal without accepting its cached grant', async () => {
    localStorage.setItem('test', JSON.stringify(saved()));
    const request = vi.fn().mockResolvedValue(ok(response()));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    localStorage.setItem('test', JSON.stringify({ ...saved(), decision: 'withdrawn' }));
    consent.changed();
    expect(consent.getSnapshot().allowed).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
});

it('refreshes the revision after a conflict so a new explicit grant can succeed', async () => {
    localStorage.setItem('test', JSON.stringify(saved()));
    const request = vi
        .fn()
        .mockResolvedValueOnce(ok(response()))
        .mockResolvedValueOnce(new Response('', { status: 409 }))
        .mockResolvedValueOnce(ok(response(false, 5)))
        .mockResolvedValueOnce(ok(response(true, 6)));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    await consent.choose('granted');
    expect(consent.getSnapshot().allowed).toBe(false);
    await consent.choose('granted');
    expect(JSON.parse(request.mock.calls[3][1].body).expected_revision).toBe(5);
    expect(consent.getSnapshot().allowed).toBe(true);
});

it('does not overwrite a cross-tab withdrawal before the storage event arrives', async () => {
    localStorage.setItem('test', JSON.stringify(saved()));
    let resolve!: (value: Response) => void;
    const request = vi.fn().mockImplementation(
        () =>
            new Promise((done) => {
                resolve = done;
            }),
    );
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    const initial = consent.start();
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    const withdrawn = {
        ...saved(),
        decision: 'withdrawn',
        pending: { request_id: 'pending-withdrawal', decision: 'withdrawn', expected_revision: 1 },
    };
    localStorage.setItem('test', JSON.stringify(withdrawn));
    resolve(ok(response()));
    await initial;
    expect(consent.getSnapshot().allowed).toBe(false);
    expect(JSON.parse(localStorage.getItem('test')!)).toEqual(withdrawn);
});

it('does not overwrite a cross-tab withdrawal while loading settings', async () => {
    localStorage.setItem('test', JSON.stringify({ ...saved(), decision: 'denied' }));
    let resolve!: (value: Response) => void;
    const request = vi.fn().mockImplementation(
        () =>
            new Promise((done) => {
                resolve = done;
            }),
    );
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    const reviewing = consent.review();
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    const withdrawn = { ...saved(), decision: 'withdrawn' };
    localStorage.setItem('test', JSON.stringify(withdrawn));
    resolve(ok(response()));
    await reviewing;
    expect(JSON.parse(localStorage.getItem('test')!)).toEqual(withdrawn);
});

it('retries an uncertain grant with its original request_id', async () => {
    const request = vi
        .fn()
        .mockResolvedValueOnce(ok(response(false, 0)))
        .mockRejectedValueOnce(new Error('response lost after commit'))
        .mockResolvedValueOnce(ok(response()));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    await consent.choose('granted');
    const original = JSON.parse(request.mock.calls[1][1].body);
    await consent.choose('granted');
    expect(JSON.parse(request.mock.calls[2][1].body)).toEqual(original);
    expect(consent.getSnapshot().allowed).toBe(true);
    expect(JSON.parse(localStorage.getItem('test')!).pending).toBeUndefined();
});

it.each([{ key: 'invalid' }, { revision: -1 }, { revision: 0.5 }, { decision: 'other' }])(
    'discards malformed saved permission %j',
    async (invalid) => {
        const previous = { ...saved(), ...invalid };
        localStorage.setItem('test', JSON.stringify(previous));
        const request = vi.fn().mockResolvedValue(ok(response(false, 0)));
        const consent = createAnalyticsConsent(localStorage, 'test', request);
        await consent.start();
        expect(consent.getSnapshot()).toMatchObject({ allowed: false, choice: undefined });
        const restored = JSON.parse(localStorage.getItem('test')!);
        expect(restored.key).toMatch(/^[a-f0-9]{64}$/);
        expect(restored.key).not.toBe(previous.key);
        expect(restored.revision).toBe(0);
    },
);

it('does not mistake a transport error message for an HTTP conflict', async () => {
    const request = vi
        .fn()
        .mockResolvedValueOnce(ok(response(false, 0)))
        .mockRejectedValue(new Error('409'));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    await consent.choose('granted');
    expect(request).toHaveBeenCalledTimes(2);
    expect(consent.getSnapshot()).toMatchObject({ allowed: false, error: true, busy: false });
    expect(JSON.parse(localStorage.getItem('test')!).pending.decision).toBe('granted');
});

it('does not finish a settings request when startup has no work', async () => {
    localStorage.setItem('test', JSON.stringify({ ...saved(), decision: 'denied' }));
    let finish!: (value: Response) => void;
    const request = vi.fn().mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    const reviewing = consent.review();
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    await consent.start();
    expect(consent.getSnapshot().busy).toBe(true);
    finish(ok(response(false)));
    await reviewing;
    expect(consent.getSnapshot()).toMatchObject({ allowed: false, busy: false, error: false });
});

it('does not publish an old grant failure after a new withdrawal succeeds', async () => {
    let fail!: (error: Error) => void;
    const request = vi
        .fn()
        .mockResolvedValueOnce(ok(response(false, 0)))
        .mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    fail = reject;
                }),
        )
        .mockResolvedValueOnce(ok(response(false, 1)));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    const granting = consent.choose('granted');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await consent.choose('withdrawn');
    fail(new Error('late network failure'));
    await granting;
    expect(consent.getSnapshot()).toMatchObject({ allowed: false, busy: false, error: false, choice: 'withdrawn' });
    expect(JSON.parse(localStorage.getItem('test')!).decision).toBe('withdrawn');
});

it('keeps a successful POST without its server receipt pending and disabled', async () => {
    const request = vi.fn()
        .mockResolvedValueOnce(ok(response(false, 0)))
        .mockResolvedValueOnce(ok({ policy, current: response().current }));
    const consent = createAnalyticsConsent(localStorage, 'test', request);
    await consent.start();
    await consent.choose('granted');
    expect(consent.getSnapshot()).toMatchObject({ allowed: false, error: true, busy: false });
    expect(JSON.parse(localStorage.getItem('test')!).pending.decision).toBe('granted');
});
