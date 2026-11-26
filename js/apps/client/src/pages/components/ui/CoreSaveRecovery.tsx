export const CoreSaveCopy = ({ operation }: { operation: unknown }) => (
    <details>
        <summary>Посмотреть сохранённую локальную правку</summary>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(operation, null, 2)}</pre>
    </details>
);

export const CoreSaveRecovery = ({
    operation,
    busy,
    error,
    onContinue,
}: {
    operation: unknown;
    busy?: boolean;
    error?: string;
    onContinue: () => void;
}) => (
    <section role="alertdialog" aria-label="Незавершённая правка предыдущего Core">
        <p>Локальная правка не отправлена автоматически. Сохраните копию и продолжите с серверной версией.</p>
        <CoreSaveCopy operation={operation} />
        {error && <p role="alert">{error}</p>}
        <button type="button" disabled={busy} onClick={onContinue}>
            Продолжить с серверной версией
        </button>
    </section>
);
