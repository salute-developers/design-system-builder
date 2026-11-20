import { describe, expect, it, vi } from 'vitest';

import { retryDraftAutosave, setDraftAutosaveRetry } from './draftAutosaveActivity';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };

describe('retryDraftAutosave', () => {
    it('повторяет все зарегистрированные очереди редактора и забывает снятые', () => {
        const component = vi.fn();
        const other = vi.fn();
        setDraftAutosaveRetry(context, 'component:web/Chip', component);
        setDraftAutosaveRetry(context, 'component:web/Button', other);
        setDraftAutosaveRetry({ ...context, tenantId: 'other' }, 'component:web/Chip', vi.fn());

        retryDraftAutosave(context);
        expect(component).toHaveBeenCalledOnce();
        expect(other).toHaveBeenCalledOnce();

        setDraftAutosaveRetry(context, 'component:web/Button', null);
        retryDraftAutosave(context);
        expect(component).toHaveBeenCalledTimes(2);
        expect(other).toHaveBeenCalledOnce();
    });
});
