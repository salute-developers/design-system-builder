import { useEffect, useRef, type RefObject } from 'react';

interface DismissOptions {
    /** Элементы, клик по которым не считается кликом снаружи: например, кнопка, открывающая окно. */
    except?: Array<RefObject<HTMLElement>>;
    /** Элемент, которому возвращается фокус после закрытия по `Escape`. */
    returnFocus?: RefObject<HTMLElement>;
}

/**
 * Закрывает всплывающее окно по клику снаружи и по `Escape`, как меню и пикеры прототипа. По `Escape` фокус
 * возвращается на `returnFocus`, чтобы клавиатура не терялась.
 */
export const useDismiss = (
    root: RefObject<HTMLElement>,
    open: boolean,
    onClose: () => void,
    { except = [], returnFocus }: DismissOptions = {},
) => {
    // Колбэк и исключения читаются в момент события: обработчики не переподписываются на каждый рендер.
    const latest = useRef({ onClose, except, returnFocus });
    latest.current = { onClose, except, returnFocus };

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            const inside = [root, ...latest.current.except].some((ref) => ref.current?.contains(target));
            if (!inside) latest.current.onClose();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            latest.current.onClose();
            latest.current.returnFocus?.current?.focus();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, root]);
};
