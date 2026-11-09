import { Modal } from '../../../components/Overlay/Overlay';
import { TyGlyph } from '../../../components/TyGlyph';

interface ComponentHideDialogProps {
    name: string;
    /** Названия платформ, на которых компонент будет скрыт. */
    platforms: string[];
    /** Видимые компоненты, которые используют этот: пока они в составе, скрыть его нельзя. */
    usedBy: string[];
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * Подтверждение скрытия компонента на общем `Modal`. Компонент, который используют другие компоненты дизайн-системы,
 * скрыть нельзя: без него их превью и сборка ломаются.
 */
export const ComponentHideDialog = ({ name, platforms, usedBy, onCancel, onConfirm }: ComponentHideDialogProps) => (
    <Modal
        title={usedBy.length ? 'Нельзя скрыть компонент' : 'Скрыть компонент?'}
        subtitle={name}
        role="alertdialog"
        describedBy="component-hide-description"
        className="component-dialog component-hide-dialog"
        closeIcon={<TyGlyph name="close" />}
        onClose={onCancel}
    >
        <p id="component-hide-description" className="component-dialog-text">
            {usedBy.length
                ? `Его используют ${usedBy.length > 1 ? 'компоненты' : 'компонент'} ${usedBy.join(', ')}. Сначала скройте ${
                      usedBy.length > 1 ? 'их' : 'его'
                  }, иначе их превью и сборка перестанут работать.`
                : `Компонент исчезнет из дизайн-системы ${
                      platforms.length > 1 ? `на платформах ${platforms.join(', ')}` : `на платформе ${platforms[0]}`
                  }. Вернуть его можно кнопкой «+» над списком.`}
        </p>
        <footer>
            {usedBy.length ? (
                <button type="button" data-autofocus onClick={onCancel}>
                    Понятно
                </button>
            ) : (
                <>
                    <button type="button" className="secondary" data-autofocus onClick={onCancel}>
                        Отмена
                    </button>
                    <button type="button" onClick={onConfirm}>
                        Скрыть
                    </button>
                </>
            )}
        </footer>
    </Modal>
);
