import { useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { IconSave } from '@salutejs/plasma-icons';

import { BasicButton, LinkButton } from '../../components';
import { Root, StyledMessage } from './SaveDesignSystemButton.styles';

const CONFLICT_CODE = 'TENANT_EDIT_CONFLICT';

type SaveState =
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'error'; message: string }
    | { status: 'conflict' };

/** Ответ сохранения: успешный, если в нём есть `editRevision` или `success: true`. */
export type SaveResult = { editRevision: number } | { success?: boolean } | null | undefined;

interface SaveDesignSystemButtonProps {
    /** Сохраняет дизайн-систему; в редакторе темы — значения токенов выбранного tenant. */
    save: () => Promise<SaveResult>;
    /** После успешного сохранения; работу, привязанную к конкретному запросу, делает сам `save`. */
    onSaved?: () => void;
    /** Действие при конфликте редактирования: загрузка актуальных данных. */
    onReload: () => void;
}

export const isSuccessfulSave = (result: SaveResult) =>
    Boolean(result && ('editRevision' in result || ('success' in result && result.success)));

/** Конфликт редактирования tenant: ответ `409` с кодом или ошибка с этим кодом в тексте. */
const isEditConflict = (error: unknown) =>
    (isAxiosError(error) && error.response?.status === 409 && error.response.data?.code === CONFLICT_CODE) ||
    (error instanceof Error && error.message.includes(CONFLICT_CODE));

/**
 * Кнопка сохранения дизайн-системы в редакторе. Показывает состояние сохранения, причину ошибки и при
 * конфликте редактирования предлагает загрузить актуальные данные. Повторную отправку сама не делает.
 */
export const SaveDesignSystemButton = (props: SaveDesignSystemButtonProps) => {
    const { save, onSaved, onReload } = props;

    const [state, setState] = useState<SaveState>({ status: 'idle' });
    const savingRef = useRef(false);

    const onSave = async () => {
        if (savingRef.current) {
            return;
        }
        savingRef.current = true;
        setState({ status: 'saving' });

        try {
            if (!isSuccessfulSave(await save())) {
                throw new Error('Не удалось сохранить изменения');
            }
            setState({ status: 'idle' });
            onSaved?.();
        } catch (error) {
            console.error('[SaveDesignSystemButton] Ошибка сохранения', error);
            setState(
                isEditConflict(error)
                    ? { status: 'conflict' }
                    : { status: 'error', message: error instanceof Error ? error.message : String(error) },
            );
        } finally {
            savingRef.current = false;
        }
    };

    return (
        <Root>
            {state.status === 'error' && <StyledMessage role="alert">{state.message}</StyledMessage>}
            {state.status === 'conflict' && (
                <>
                    <StyledMessage role="alert">Тема уже изменена в другой сессии. Черновик сохранён.</StyledMessage>
                    <LinkButton text="Загрузить актуальные данные" onClick={onReload} />
                </>
            )}
            {/* При конфликте повтор отправил бы ту же устаревшую ревизию: остаётся только загрузка данных */}
            {state.status !== 'conflict' && (
                <BasicButton
                    text={state.status === 'saving' ? 'Сохраняем…' : 'Сохранить'}
                    contentRight={<IconSave size="xs" color="inherit" />}
                    aria-busy={state.status === 'saving'}
                    onClick={onSave}
                />
            )}
        </Root>
    );
};
