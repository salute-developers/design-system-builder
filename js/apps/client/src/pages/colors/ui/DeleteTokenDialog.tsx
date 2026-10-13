interface DeleteTokenDialogProps {
    displayName: string;
    components: string[];
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Подтверждение удаления токена со списком компонентов, где он используется. */
export const DeleteTokenDialog = ({
    displayName,
    components,
    busy,
    error,
    onCancel,
    onConfirm,
}: DeleteTokenDialogProps) => (
    <div className="modal-backdrop custom-token-backdrop">
        <section
            className="entity-modal custom-token-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-token-title"
        >
            <header>
                <div>
                    <span>{displayName}</span>
                    <h2 id="delete-token-title">Удалить токен?</h2>
                </div>
                <button type="button" className="source-palette-modal-close" aria-label="Закрыть" onClick={onCancel}>
                    ×
                </button>
            </header>
            <div className="custom-token-form">
                <p>Токен удалится из дизайн-системы вместе со значениями во всех темах. Удаление нельзя отменить.</p>
                {components.length > 0 ? (
                    <p data-testid="delete-token-components">
                        Используется в компонентах: {components.join(', ')}. Ссылки компонентов на токен будут сброшены.
                    </p>
                ) : (
                    <p>Токен не используется в компонентах дизайн-системы.</p>
                )}
                {error && (
                    <p className="custom-token-error" role="alert">
                        {error}
                    </p>
                )}
            </div>
            <footer>
                <button type="button" className="secondary" onClick={onCancel}>
                    Отмена
                </button>
                <button type="button" disabled={busy} onClick={onConfirm}>
                    Удалить токен
                </button>
            </footer>
        </section>
    </div>
);
