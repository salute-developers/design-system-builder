import type { AutosaveStatus } from '../api/tokenAutosaveQueue';

const labels: Record<Exclude<AutosaveStatus, 'error'>, string> = {
    pending: 'Ожидает сохранения',
    saving: 'Сохраняется…',
    saved: 'Сохранено',
};

export const AutosaveIndicator = ({ status, retry }: { status: AutosaveStatus; retry: () => void }) => (
    <div className={`editor-autosave-status is-${status}`} role={status === 'error' ? 'alert' : 'status'}>
        {status === 'error' ? (
            <button type="button" onClick={retry}>
                Не сохранено. Повторить
            </button>
        ) : (
            labels[status]
        )}
    </div>
);
