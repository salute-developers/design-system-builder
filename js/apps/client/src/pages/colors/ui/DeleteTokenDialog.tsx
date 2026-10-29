interface DeleteTokenDialogProps {
    displayName: string;
    /** Удаление группы или подгруппы: число её токенов; `null` — удаление токена. */
    group?: { tokens: number } | null;
    components: string[];
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

const tokensLabel = (count: number) => {
    const tail = count % 100 >= 11 && count % 100 <= 14 ? 5 : count % 10;
    return `${count} ${tail === 1 ? 'токен' : tail >= 2 && tail <= 4 ? 'токена' : 'токенов'}`;
};

/** Подтверждение удаления токена или группы с токенами со списком компонентов, где они используются. */
export const DeleteTokenDialog = ({
    displayName,
    group = null,
    components,
    busy,
    error,
    onCancel,
    onConfirm,
}: DeleteTokenDialogProps) => (
    <div className="modal-backdrop custom-token-backdrop">
        <section
            className="entity-modal custom-token-modal delete-token-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-token-title"
        >
            <header>
                <div>
                    <span>{displayName}</span>
                    <h2 id="delete-token-title">{group ? 'Удалить группу?' : 'Удалить токен?'}</h2>
                </div>
                <button type="button" className="source-palette-modal-close" aria-label="Закрыть" onClick={onCancel}>
                    ×
                </button>
            </header>
            <div className="custom-token-form">
                {group ? (
                    <p data-testid="delete-group-tokens">
                        Удалятся группа, её подгруппы и {tokensLabel(group.tokens)} со значениями во всех темах.
                        Удаление нельзя отменить.
                    </p>
                ) : (
                    <p>
                        Токен удалится из дизайн-системы вместе со значениями во всех темах. Удаление нельзя отменить.
                    </p>
                )}
                {components.length > 0 ? (
                    <p data-testid="delete-token-components">
                        Используется в компонентах: {components.join(', ')}. Ссылки компонентов на токен будут сброшены.
                    </p>
                ) : (
                    <p>
                        {group ? 'Токены группы не используются' : 'Токен не используется'} в компонентах
                        дизайн-системы.
                    </p>
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
                    {group ? 'Удалить группу' : 'Удалить токен'}
                </button>
            </footer>
        </section>
    </div>
);
