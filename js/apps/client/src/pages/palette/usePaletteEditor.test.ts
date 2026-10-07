import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({ source: 'local' as 'local' | 'api', load: vi.fn() }));
vi.mock('../../palette/paletteSession', () => ({ paletteRepository: repository }));

import type { DesignSystem } from '../../controllers';
import { PaletteOperationError, type ThemePalette } from '../../modules/palette';
import { paletteRevision, usePaletteEditor } from './usePaletteEditor';

const palette = { tenantId: 't', editRevision: 3 } as ThemePalette;
const designSystem = (editRevision?: number) => {
    const parameters = { editRevision };
    return { getParameters: () => parameters } as unknown as DesignSystem;
};
const context = { projectId: 'p', designSystemId: 'd', tenantId: 't' };

const renderEditor = (ds: DesignSystem) => {
    const props = { context, palette, designSystem: ds, setPalette: vi.fn(), rerender: vi.fn(), reload: vi.fn() };
    const hook = renderHook(() => usePaletteEditor(props));
    return { ...hook, props };
};

const conflict = () => new PaletteOperationError(409, 'TENANT_EDIT_CONFLICT', 'Conflict');

beforeEach(() => {
    vi.clearAllMocks();
    repository.load.mockResolvedValue(palette);
});

describe('paletteRevision', () => {
    it('в режиме local берёт ревизию палитры', () => {
        repository.source = 'local';
        expect(paletteRevision(palette, designSystem(7))).toBe(3);
    });

    it('в режиме api берёт общую ревизию темы, а без неё — ревизию палитры', () => {
        repository.source = 'api';
        expect(paletteRevision(palette, designSystem(7))).toBe(7);
        expect(paletteRevision(palette, designSystem())).toBe(3);
        expect(paletteRevision(palette, null)).toBe(3);
    });
});

describe('usePaletteEditor.run', () => {
    it('api: операция идёт с ревизией темы, новая ревизия записывается в параметры темы', async () => {
        repository.source = 'api';
        const ds = designSystem(7);
        const { result, props } = renderEditor(ds);
        const operation = vi.fn(async (editRevision: number) => ({ editRevision: editRevision + 1, value: 'ok' }));
        await act(() => result.current.run(operation, () => ({ title: 'Готово' })));
        expect(operation).toHaveBeenCalledWith(7);
        expect(ds.getParameters()?.editRevision).toBe(8);
        expect(props.rerender).toHaveBeenCalled();
        expect(result.current.toast).toMatchObject({ tone: 'success', title: 'Готово' });
    });

    it('api: конфликт перечитывает тему, уведомление показывает новый экран', async () => {
        repository.source = 'api';
        const { result, props, unmount } = renderEditor(designSystem(7));
        await act(() => result.current.run(() => Promise.reject(conflict()), () => ({ title: 'Готово' })));
        expect(props.reload).toHaveBeenCalledTimes(1);
        expect(repository.load).not.toHaveBeenCalled();
        unmount();
        const next = renderEditor(designSystem(9));
        expect(next.result.current.toast).toMatchObject({ tone: 'error', title: 'Тема изменена в другом месте' });
    });

    it('local: конфликт перечитывает только палитру', async () => {
        repository.source = 'local';
        const { result, props } = renderEditor(designSystem());
        await act(() => result.current.run(() => Promise.reject(conflict()), () => ({ title: 'Готово' })));
        expect(props.reload).not.toHaveBeenCalled();
        expect(props.setPalette).toHaveBeenCalledWith(palette);
        expect(result.current.toast).toMatchObject({ tone: 'error' });
    });

    it('другая ошибка не меняет палитру и показывает текст ошибки', async () => {
        repository.source = 'local';
        const { result, props } = renderEditor(designSystem());
        await act(() => result.current.run(() => Promise.reject(new Error('Сбой')), () => ({ title: 'Готово' })));
        expect(props.setPalette).not.toHaveBeenCalled();
        expect(result.current.toast).toMatchObject({ tone: 'error', title: 'Не удалось изменить палитру', text: 'Сбой' });
    });
});
