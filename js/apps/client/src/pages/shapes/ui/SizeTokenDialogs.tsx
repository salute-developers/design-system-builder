import { ConfirmDeleteDialog } from '../../../components/tokenWorkspace';
import { type DeletedUsage } from '../../../modules/sizeTokens';

interface DeleteDialogProps {
    /** Под заголовком: имя токена. */
    title: string;
    /** Имена удаляемых токенов. */
    names: string[];
    /** Компоненты, которые используют удаляемые токены, с этими токенами. */
    components: DeletedUsage[];
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Подтверждение удаления токена, который используют компоненты, — общее окно экранов токенов. */
export const DeleteSizeTokenDialog = ({
    title,
    names,
    components,
    busy,
    error,
    onCancel,
    onConfirm,
}: DeleteDialogProps) => (
    <ConfirmDeleteDialog
        titleId="delete-size-token-title"
        title="Удалить токен?"
        meta={title}
        confirmLabel="Удалить токен"
        busy={busy}
        error={error}
        onCancel={onCancel}
        onConfirm={onConfirm}
    >
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
    </ConfirmDeleteDialog>
);
