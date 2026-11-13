import { ConfirmDeleteDialog } from '../../../components/tokenWorkspace';

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

/**
 * Подтверждение удаления токена или группы, в том числе пустой (`Dialog/Confirmation` Tone=Danger), со списком
 * компонентов, где они используются.
 */
export const DeleteTokenDialog = ({
    displayName,
    group = null,
    components,
    busy,
    error,
    onCancel,
    onConfirm,
}: DeleteTokenDialogProps) => (
    <ConfirmDeleteDialog
        titleId="delete-token-title"
        title={group ? 'Удалить группу?' : 'Удалить токен?'}
        meta={displayName}
        confirmLabel={group ? 'Удалить группу' : 'Удалить токен'}
        busy={busy}
        error={error}
        onCancel={onCancel}
        onConfirm={onConfirm}
    >
        {group ? (
            <p data-testid="delete-group-tokens">
                Вы уверены, что хотите удалить группу {displayName}?{' '}
                {group.tokens
                    ? `Удалятся группа, её подгруппы и ${tokensLabel(group.tokens)} со значениями во всех темах.`
                    : 'Группа пустая: токенов в ней нет.'}{' '}
                Удаление нельзя отменить.
            </p>
        ) : (
            <p>
                Вы уверены, что хотите удалить токен {displayName}? Токен удалится из дизайн-системы вместе со
                значениями во всех темах. Удаление нельзя отменить.
            </p>
        )}
        {components.length > 0 ? (
            <p data-testid="delete-token-components">
                Используется в компонентах: {components.join(', ')}. Ссылки компонентов на токен будут сброшены.
            </p>
        ) : (
            <p>{group ? 'Токены группы не используются' : 'Токен не используется'} в компонентах дизайн-системы.</p>
        )}
    </ConfirmDeleteDialog>
);
