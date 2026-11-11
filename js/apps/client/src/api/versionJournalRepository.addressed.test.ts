import { beforeEach, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { DraftChangeDto } from './editorContracts';

const mocks = vi.hoisted(() => ({ post: vi.fn(), read: vi.fn(), invalidate: vi.fn() }));
vi.mock('./http', () => ({ http: { post: mocks.post } }));
vi.mock('./editorReads', () => ({ readEditor: mocks.read, invalidateEditorReads: mocks.invalidate }));
import { VersionJournalRepository } from './versionJournalRepository';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 'theme' };
const repository = new VersionJournalRepository();
const target = { entityType: 'token-value', entityId: 'value', expectedRevision: 3, operation: 'updated' };
const page = (targets: unknown[], nextCursor: string | null) => ({data: {
    draftId: 'draft', scopeRevision: 'scope', targets, nextCursor,
}});
beforeEach(() => { vi.clearAllMocks(); mocks.post.mockResolvedValue({ data: {ok:true} }); });

it('sends selected journal addresses without journal lookup', async () => {
    await repository.revertChanges(context, [{versionId:'draft', entityType:'token-value', entityId:'value', editRevision:3} as DraftChangeDto]);
    expect(mocks.post).toHaveBeenCalledWith(expect.stringContaining('/changes/revert-by-address'),
        {draftId:'draft', targets:[{entityType:'token-value',entityId:'value',expectedRevision:3}]},
        {headers:{'Idempotency-Key':expect.any(String)}});
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalledWith(context);
});

it('rejects mixed draft snapshots before mutation', async () => {
    await expect(repository.revertChanges(context,[{versionId:'a'},{versionId:'b'}] as DraftChangeDto[])).rejects.toThrow();
    expect(mocks.post).not.toHaveBeenCalled();
});

it('serializes inspector targets without discovery metadata', async () => {
    const targets = Array.from({ length: 36 }, (_, index) => ({
        ...target, entityId: `value-${index}`, expectedRevision: 4,
    }));
    await repository.revertAddressed(context, 'draft', targets);
    expect(mocks.post).toHaveBeenCalledWith(expect.stringContaining('/changes/revert-by-address'), {
        draftId: 'draft',
        targets: targets.map(({ entityType, entityId, expectedRevision }) => ({ entityType, entityId, expectedRevision })),
    }, { headers: { 'Idempotency-Key': expect.any(String) } });
    expect(mocks.read).not.toHaveBeenCalled();
});

it('collects scoped pages including deleted values without GET changes', async () => {
    mocks.read.mockResolvedValueOnce(page([target],'next')).mockResolvedValueOnce(page([{...target,entityId:'deleted',operation:'deleted'}],null));
    const result = await repository.listTokenTargets(context,new Set(['token']),'draft');
    expect(result.targets.map(x=>x.entityId)).toEqual(['value','deleted']);
    expect(mocks.read).toHaveBeenNthCalledWith(1,expect.stringContaining('/changes/token-targets'),{},
        {draftId:'draft',tenantId:'theme',tokenIds:['token'],cursor:null});
    expect(mocks.read).toHaveBeenNthCalledWith(2,expect.stringContaining('/changes/token-targets'),{},
        {draftId:'draft',tenantId:'theme',tokenIds:['token'],cursor:'next'});
    expect(mocks.post).not.toHaveBeenCalled();
});

it('restarts discovery after snapshot conflict before any mutation', async () => {
    const conflict = new AxiosError('changed', undefined, undefined, undefined,
        {data:{code:'TARGET_SNAPSHOT_CHANGED'},status:409,statusText:'Conflict',headers:{},config:{} as never});
    mocks.read.mockResolvedValueOnce(page([{...target,entityId:'old'}],'next')).mockRejectedValueOnce(conflict)
        .mockResolvedValueOnce(page([target],null));
    const result = await repository.listTokenTargets(context,new Set(['token']),'draft');
    expect(result.targets).toEqual([target]);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.read).toHaveBeenCalledTimes(3);
});

it('rejects repeated cursors and mixed scope snapshots without mutation', async () => {
    mocks.read.mockResolvedValue(page([target],'loop'));
    await expect(repository.listTokenTargets(context,new Set(['token']),'draft')).rejects.toThrow();
    expect(mocks.post).not.toHaveBeenCalled();
});
