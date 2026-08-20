import { BasicButton } from '../../../../../../components';

import { StyledDialog } from './DeleteTokenDialog.styles';

interface DeleteTokenDialogProps {
    opened: boolean;
    anchor?: HTMLElement;
    tokenDisplayName?: string;
    onCancel: () => void;
    onConfirm: () => void;
}

export const DeleteTokenDialog = (props: DeleteTokenDialogProps) => {
    const { opened, anchor, tokenDisplayName, onCancel, onConfirm } = props;

    return (
        <StyledDialog
            opened={opened}
            title="Удаление токена"
            actions={[
                <BasicButton key="cancel" text="Отмена" onClick={onCancel} />,
                <BasicButton key="confirm" text="Удалить" backgroundColor="#D13535" onClick={onConfirm} />,
            ]}
            anchor={anchor}
            onClose={onCancel}
        >
            Вы уверены, что хотите удалить токен {tokenDisplayName}? Обратите внимание: после публикации библиотеки токен
            будет безвозвратно удален.
        </StyledDialog>
    );
};
