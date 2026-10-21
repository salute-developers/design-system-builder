import { type DeletedUsage } from '../../../modules/sizeTokens';

interface DeleteDialogProps {
    /** Над заголовком: имя токена или «тень M». */
    title: string;
    /** Имена удаляемых токенов: у тени — четыре варианта размера. */
    names: string[];
    /** Компоненты, которые используют удаляемые токены, с этими токенами. */
    components: DeletedUsage[];
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Подтверждение удаления токена, который используют компоненты, — по образцу `DeleteTokenDialog` «Цветов». */
export const DeleteSizeTokenDialog = ({
    title,
    names,
    components,
    busy,
    error,
    onCancel,
    onConfirm,
}: DeleteDialogProps) => (
    <div className="modal-backdrop custom-token-backdrop">
        <section
            className="entity-modal custom-token-modal delete-token-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-size-token-title"
        >
            <header>
                <div>
                    <span>{title}</span>
                    <h2 id="delete-size-token-title">Удалить токен?</h2>
                </div>
                <button type="button" className="source-palette-modal-close" aria-label="Закрыть" onClick={onCancel}>
                    ×
                </button>
            </header>
            <div className="custom-token-form">
                <p data-testid="delete-size-token-names">
                    {names.length > 1
                        ? `Удалятся токены ${names.join(', ')} из черновика дизайн-системы`
                        : 'Токен удалится из черновика дизайн-системы'}{' '}
                    вместе со значениями во всех темах. До публикации удаление можно отменить в журнале изменений.
                </p>
                <p data-testid="delete-size-token-components">
                    Используется в компонентах:{' '}
                    {components
                        .map((usage) => (names.length > 1 ? `${usage.name} (${usage.tokens.join(', ')})` : usage.name))
                        .join(', ')}
                    . Ссылки компонентов на токен будут сброшены.
                </p>
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
