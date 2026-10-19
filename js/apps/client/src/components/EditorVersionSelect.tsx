import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import type { EditorContextKey } from '../api/editorContracts';
import { useVersionList } from '../features/versionJournal/useVersionList';
import { hasPersistedComponentMutation, waitForDraftAutosaveIdle } from '../api/draftAutosaveActivity';
import { StyledSelect } from './Overlay/Overlay';

/** Единственный переключатель временной границы всего редактора. История версий имеет отдельный выбор. */
export const EditorVersionSelect = ({ context, draftId }: { context: EditorContextKey; draftId?: string }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [switching, setSwitching] = useState(false);
    const [error, setError] = useState<string>();
    const { versionId } = context;

    const { versions, loading, error: loadError, reload } = useVersionList(context, draftId, true);

    const selectVersion = async (selected: string) => {
        if (selected === (versionId ?? 'draft')) return;
        setSwitching(true);
        setError(undefined);
        try {
            if (!versionId) {
                await waitForDraftAutosaveIdle(context, 10_000);
                if (hasPersistedComponentMutation(context)) throw new Error('pending component');
            }
            const next = new URLSearchParams(searchParams);
            if (selected === 'draft') next.delete('versionId');
            else next.set('versionId', selected);
            const pathname =
                selected !== 'draft' && location.pathname.endsWith('/settings')
                    ? location.pathname.replace(/\/settings$/, '/colors')
                    : location.pathname;
            navigate({ pathname, search: next.toString() });
        } catch {
            setError('Есть несохранённые изменения. Дождитесь сохранения и повторите выбор версии.');
        } finally {
            setSwitching(false);
        }
    };

    const options = [
        { value: 'draft', label: 'Черновик' },
        ...[...versions]
            .sort((left, right) => right.sequenceNumber - left.sequenceNumber)
            .map((version) => ({ value: version.id, label: `v${version.version}` })),
    ];
    if (versionId && !versions.some(({ id }) => id === versionId)) {
        options.push({ value: versionId, label: loading ? 'Загрузка версии…' : 'Версия недоступна' });
    }
    return (
        <div className="editor-version-selector">
            <StyledSelect
                className="editor-version-select"
                label="Версия редактора"
                value={versionId ?? 'draft'}
                options={options}
                disabled={switching || loading}
                popoverWidth="content"
                onChange={(selected) => void selectVersion(selected)}
            />
            {(error || loadError) && (
                <div className="editor-version-error" role="alert">
                    {error || loadError}
                    <button
                        type="button"
                        onClick={() => {
                            setError(undefined);
                            void reload();
                        }}
                    >
                        Повторить
                    </button>
                </div>
            )}
        </div>
    );
};
