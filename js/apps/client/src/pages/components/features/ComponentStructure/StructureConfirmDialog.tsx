import { Modal } from '../../../../components/Overlay/Overlay';
import { TyGlyph } from '../../../../components/TyGlyph';

interface StructureConfirmDialogProps {
    /** Под заголовком: что удаляется, например «Вариация size». */
    subject: string;
    title: string;
    text: string;
    confirmLabel: string;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * Подтверждение удаления конфигурации, вариации или значения на общем `Modal`: со структурой удаляются
 * и значения свойств.
 */
export const StructureConfirmDialog = (props: StructureConfirmDialogProps) => (
    <Modal
        title={props.title}
        subtitle={props.subject}
        role="alertdialog"
        describedBy="component-structure-confirm-text"
        className="component-dialog component-structure-confirm-dialog"
        closeIcon={<TyGlyph name="close" />}
        onClose={props.onCancel}
    >
        <p id="component-structure-confirm-text" className="component-dialog-text">
            {props.text}
        </p>
        <footer>
            <button type="button" className="secondary" data-autofocus onClick={props.onCancel}>
                Отмена
            </button>
            <button type="button" disabled={props.busy} onClick={props.onConfirm}>
                {props.confirmLabel}
            </button>
        </footer>
    </Modal>
);
