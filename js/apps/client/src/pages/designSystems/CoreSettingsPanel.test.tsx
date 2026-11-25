import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { http } from '../../api/http';
import { CoreSettingsPanel, type CoreSaveState } from './CoreSettingsPanel';

const Panel = (props: Parameters<typeof CoreSettingsPanel>[0]) => {
    const [state, setState] = useState<CoreSaveState>({ disabled: true, saving: false });
    return (
        <>
            <button type="submit" form="core-library-settings-form" disabled={state.disabled}>
                Сохранить
            </button>
            <CoreSettingsPanel {...props} onSaveStateChange={setState} />
        </>
    );
};

vi.mock('../../api/http', () => ({ http: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../api/editorReads', () => ({ invalidateEditorReads: vi.fn() }));
const a = { releaseId: 'a', platform: 'compose', channel: 'stable', version: 'A' };
const b = { releaseId: 'b', platform: 'compose', channel: 'dev', version: 'B' };
const report = (release = a, revision = 1) => ({
    context: { draftId: 'draft', coreSelectionRevision: revision, coreReleases: [release] },
    blockingCount: 0,
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});

it('saves only the explicitly chosen platform and uses the selection revision', async () => {
    vi.mocked(http.get).mockImplementation(async (url, config) => ({
        data: String(url).endsWith('/core-settings')
            ? report()
            : config?.params.platform === 'compose'
              ? [config.params.channel === 'dev' ? b : a]
              : [],
    }));
    vi.mocked(http.put).mockResolvedValue({ data: report(b, 2) });
    render(<Panel projectId="project" designSystemId="system" />);
    const channel = await screen.findByLabelText('Compose: канал');
    fireEvent.click(channel);
    fireEvent.click(screen.getByRole('option', { name: 'dev', exact: true }));
    expect(http.put).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await waitFor(() => expect(screen.getByLabelText('Compose: версия')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    fireEvent.click(screen.getByRole('option', { name: 'B', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() =>
        expect(http.put).toHaveBeenCalledExactlyOnceWith(
            expect.stringContaining('/core-settings/compose'),
            {
                channel: 'dev',
                releaseId: 'b',
                expectedDraftId: 'draft',
                expectedCoreSelectionRevision: 1,
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Версии библиотек сохранены');
});

it('does not automatically select a version for an empty platform or offer editing in history', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: report() });
    render(<Panel projectId="project" designSystemId="system" versionId="published" />);
    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(screen.queryByLabelText('Compose: канал')).not.toBeInTheDocument();
    expect(screen.getAllByText('Библиотека не выбрана')).toHaveLength(3);
    expect(http.put).not.toHaveBeenCalled();
});

it('ignores a late draft save after navigating to the published boundary', async () => {
    let finish!: (value: { data: ReturnType<typeof report> }) => void;
    vi.mocked(http.get).mockImplementation(async (url, config) => ({
        data: String(url).endsWith('/core-settings')
            ? report()
            : config?.params.platform === 'compose'
              ? [config.params.channel === 'dev' ? b : a]
              : [],
    }));
    vi.mocked(http.put).mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const panel = render(<Panel projectId="project" designSystemId="system" />);
    fireEvent.click(await screen.findByLabelText('Compose: канал'));
    fireEvent.click(screen.getByRole('option', { name: 'dev', exact: true }));
    await waitFor(() => expect(screen.getByLabelText('Compose: версия')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    fireEvent.click(screen.getByRole('option', { name: 'B', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(http.put).toHaveBeenCalledOnce());
    panel.rerender(<Panel projectId="project" designSystemId="system" versionId="published" />);
    expect(await screen.findByText('A')).toBeInTheDocument();
    finish({ data: report(b, 2) });
    await waitFor(() => expect(screen.queryByText('B')).not.toBeInTheDocument());
    expect(screen.getByText('A')).toBeInTheDocument();
});

it('keeps the saved version marked while choosing a different version', async () => {
    vi.mocked(http.get).mockImplementation(async (url, config) => ({
        data: String(url).endsWith('/core-settings')
            ? report()
            : config?.params.platform === 'compose'
              ? [a, { ...b, channel: 'stable' }]
              : [],
    }));
    render(<Panel projectId="project" designSystemId="system" />);
    await waitFor(() => expect(screen.getByLabelText('Compose: версия')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    expect(screen.getByRole('option', { name: 'A, сохранённая версия' })).toHaveTextContent('✓');
    fireEvent.click(screen.getByRole('option', { name: 'B', exact: true }));
    expect(screen.getByLabelText('Compose: версия')).toHaveTextContent('B');
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    expect(screen.getByRole('option', { name: 'A, сохранённая версия' })).toHaveTextContent('✓');
    expect(http.put).not.toHaveBeenCalled();
});

it('preserves pending choices after a partial save and retries only the remaining platform', async () => {
    const web = { ...a, platform: 'web', releaseId: 'web-a' };
    const webB = { ...b, platform: 'web', releaseId: 'web-b' };
    const both = (compose = a, selectedWeb = web, revision = 1) => ({
        ...report(compose, revision),
        context: { ...report(compose, revision).context, coreReleases: [compose, selectedWeb] },
    });
    vi.mocked(http.get).mockImplementation(async (url, config) => ({
        data: String(url).endsWith('/core-settings')
            ? both()
            : config?.params.platform === 'compose'
              ? [config.params.channel === 'dev' ? b : a]
              : config?.params.platform === 'web'
                ? config.params.channel === 'stable'
                    ? [web]
                    : config.params.offset === 50
                      ? [webB]
                      : Array.from({ length: 50 }, (_, i) => ({
                            ...webB,
                            releaseId: `web-page-one-${i}`,
                            version: `Web page one ${i}`,
                        }))
                : [],
    }));
    vi.mocked(http.put)
        .mockResolvedValueOnce({ data: both(b, web, 2) })
        .mockRejectedValueOnce(new Error('unavailable'))
        .mockResolvedValueOnce({ data: both(b, webB, 3) });
    render(<Panel projectId="project" designSystemId="system" />);
    for (const label of ['Compose', 'Web']) {
        fireEvent.click(await screen.findByLabelText(`${label}: канал`));
        fireEvent.click(screen.getByRole('option', { name: 'dev', exact: true }));
        if (label === 'Web') fireEvent.click(await screen.findByRole('button', { name: 'Ещё версии' }));
        await waitFor(() => expect(screen.getByLabelText(`${label}: версия`)).toBeEnabled());
        fireEvent.click(screen.getByLabelText(`${label}: версия`));
        fireEvent.click(screen.getByRole('option', { name: 'B', exact: true }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Сохранены: Compose. Не удалось сохранить Web');
    expect(vi.mocked(http.put).mock.calls[1][1]).toMatchObject({
        expectedCoreSelectionRevision: 2,
        releaseId: 'web-b',
    });
    expect(screen.getByLabelText('Web: версия')).toHaveTextContent('B');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByRole('status');
    expect(http.put).toHaveBeenCalledTimes(3);
    expect(vi.mocked(http.put).mock.calls[2][0]).toContain('/core-settings/web');
});

it('defaults the legacy channel filter to stable without offering an unknown version', async () => {
    vi.mocked(http.get).mockImplementation(async (url) => ({
        data: String(url).endsWith('/core-settings')
            ? report({
                  ...a,
                  channel: null,
                  version: 'catalog-at-migration',
                  provenance: 'migration-snapshot',
              } as unknown as typeof a)
            : [],
    }));
    render(<Panel projectId="project" designSystemId="system" />);
    expect(await screen.findByLabelText('Compose: канал')).toHaveTextContent('stable');
    await waitFor(() => expect(screen.getByLabelText('Compose: версия')).toBeEnabled());
    expect(screen.getByLabelText('Compose: версия')).toHaveTextContent('Выберите версию');
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    expect(screen.queryByRole('option', { name: /Неизвестно/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
    expect(screen.queryByText('catalog-at-migration')).not.toBeInTheDocument();
    expect(http.put).not.toHaveBeenCalled();
});

it('saves latest as a policy and allows pinning the same resolved release', async () => {
    vi.mocked(http.get).mockImplementation(async (url, config) => ({
        data: String(url).endsWith('/core-settings') ? report() : config?.params.platform === 'compose' ? [a] : [],
    }));
    vi.mocked(http.put)
        .mockResolvedValueOnce({ data: report({ ...a, selectionMode: 'latest' } as typeof a, 2) })
        .mockResolvedValueOnce({ data: report(a, 3) });
    render(<Panel projectId="project" designSystemId="system" />);
    await waitFor(() => expect(screen.getByLabelText('Compose: версия')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    fireEvent.click(screen.getByRole('option', { name: 'Последняя (A)', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByRole('status');
    expect(vi.mocked(http.put).mock.calls[0][1]).toEqual({
        channel: 'stable',
        selectionMode: 'latest',
        expectedDraftId: 'draft',
        expectedCoreSelectionRevision: 1,
    });
    expect(screen.getByLabelText('Compose: версия')).toHaveTextContent('Последняя (A)');
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    expect(screen.getByRole('option', { name: 'Последняя (A), сохранённая версия' })).toHaveTextContent('✓');
    fireEvent.click(screen.getByRole('option', { name: 'A', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(http.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(http.put).mock.calls[1][1]).toEqual({
        channel: 'stable',
        releaseId: 'a',
        expectedDraftId: 'draft',
        expectedCoreSelectionRevision: 2,
    });
});

it('retries the failed catalog page before advancing the offset', async () => {
    const offsets: number[] = [];
    let failNextPage = true;
    vi.mocked(http.get).mockImplementation(async (url, config) => {
        if (String(url).endsWith('/core-settings')) return { data: report() };
        if (config?.params.platform !== 'compose') return { data: [] };
        const offset = Number(config.params.offset);
        offsets.push(offset);
        if (offset === 50 && failNextPage) {
            failNextPage = false;
            throw new Error('unavailable');
        }
        return {
            data: Array.from({ length: 50 }, (_, index) => ({
                ...a,
                releaseId: `release-${offset + index}`,
                version: `Release ${offset + index}`,
            })),
        };
    });
    render(<Panel projectId="project" designSystemId="system" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ещё версии' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить версии');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(offsets).toEqual([0, 50, 50]));
    await waitFor(() => expect(screen.getByLabelText('Compose: версия')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    fireEvent.click(screen.getByRole('option', { name: 'Release 50', exact: true }));
    expect(screen.getByLabelText('Compose: версия')).toHaveTextContent('Release 50');
    fireEvent.click(screen.getByRole('button', { name: 'Ещё версии' }));
    await waitFor(() => expect(offsets).toEqual([0, 50, 50, 100]));
    expect(http.put).not.toHaveBeenCalled();
});

it('refreshes a stale selection revision while preserving the unsaved version', async () => {
    let revision = 1;
    vi.mocked(http.get).mockImplementation(async (url, config) => ({
        data: String(url).endsWith('/core-settings')
            ? report(a, revision++)
            : config?.params.platform === 'compose'
              ? [config.params.channel === 'dev' ? b : a]
              : [],
    }));
    vi.mocked(http.put)
        .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { code: 'CORE_SELECTION_STALE' } } })
        .mockResolvedValueOnce({ data: report(b, 3) });
    render(<Panel projectId="project" designSystemId="system" />);
    fireEvent.click(await screen.findByLabelText('Compose: канал'));
    fireEvent.click(screen.getByRole('option', { name: 'dev', exact: true }));
    const version = screen.getByLabelText('Compose: версия');
    await waitFor(() => expect(version).toBeEnabled());
    fireEvent.click(version);
    fireEvent.click(screen.getByRole('option', { name: 'B', exact: true }));
    const save = screen.getByRole('button', { name: 'Сохранить' });
    fireEvent.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('Настройки изменились');
    expect(version).toHaveTextContent('B');
    fireEvent.click(save);
    await waitFor(() =>
        expect(http.put).toHaveBeenLastCalledWith(
            expect.stringContaining('/core-settings/compose'),
            expect.objectContaining({ releaseId: 'b', expectedCoreSelectionRevision: 2 }),
            expect.anything(),
        ),
    );
});

it('allows retrying a failed initial load', async () => {
    vi.mocked(http.get).mockRejectedValueOnce(new Error('unavailable')).mockImplementation(async (url) => ({
        data: String(url).endsWith('/core-settings') ? report() : [],
    }));
    render(<Panel projectId="project" designSystemId="system" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    expect(await screen.findByLabelText('Compose: канал')).toBeInTheDocument();
});

it('shows the resolved latest from the server and refreshes the catalog after saving', async () => {
    const resolved = { ...b, channel: a.channel, selectionMode: 'latest' };
    let composeCatalogReads = 0;
    vi.mocked(http.get).mockImplementation(async (url, config) => {
        if (String(url).endsWith('/core-settings')) return { data: report() };
        if (config?.params.platform === 'compose') {
            composeCatalogReads += 1;
            return { data: [a] };
        }
        return { data: [] };
    });
    vi.mocked(http.put).mockResolvedValue({ data: report(resolved, 2) });
    render(<Panel projectId="project" designSystemId="system" />);
    await waitFor(() => expect(screen.getByLabelText('Compose: версия')).toBeEnabled());
    fireEvent.click(screen.getByLabelText('Compose: версия'));
    fireEvent.click(screen.getByRole('option', { name: 'Последняя (A)', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByRole('status');
    await waitFor(() => expect(composeCatalogReads).toBe(2));
    expect(screen.getByLabelText('Compose: версия')).toHaveTextContent('Последняя (B)');
});

it('retries the first catalog page without switching the channel', async () => {
    const offsets: number[] = [];
    vi.mocked(http.get).mockImplementation(async (url, config) => {
        if (String(url).endsWith('/core-settings')) return { data: report() };
        if (config?.params.platform !== 'compose') return { data: [] };
        offsets.push(Number(config.params.offset));
        if (offsets.length === 1) throw new Error('unavailable');
        return { data: [a] };
    });
    render(<Panel projectId="project" designSystemId="system" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить версии');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(offsets).toEqual([0, 0]));
    expect(screen.getByLabelText('Compose: канал')).toHaveTextContent('stable');
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
