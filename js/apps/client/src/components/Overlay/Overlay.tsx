import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const getAnchoredPopoverGeometry = ({
    anchor,
    naturalHeight,
    preferredWidth,
    viewportWidth,
    viewportHeight,
}: {
    anchor: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width'>;
    naturalHeight: number;
    preferredWidth?: number;
    viewportWidth: number;
    viewportHeight: number;
}) => {
    const viewportGap = 8;
    const gap = 4;
    const width = Math.min(preferredWidth ?? anchor.width, Math.max(0, viewportWidth - viewportGap * 2));
    const availableBelow = Math.max(0, viewportHeight - viewportGap - anchor.bottom - gap);
    const availableAbove = Math.max(0, anchor.top - gap - viewportGap);
    const placeBelow = availableBelow >= naturalHeight || availableBelow >= availableAbove;
    const maxHeight = placeBelow ? availableBelow : availableAbove;
    const renderedHeight = Math.min(naturalHeight, maxHeight);
    const left = Math.min(
        Math.max(viewportGap, anchor.left),
        Math.max(viewportGap, viewportWidth - width - viewportGap),
    );
    const top = placeBelow ? anchor.bottom + gap : Math.max(viewportGap, anchor.top - gap - renderedHeight);
    return { left, top, width, maxHeight };
};

export const focusRelativeToTrigger = (trigger: HTMLElement, popover: HTMLElement | null, backward: boolean) => {
    const focusable = Array.from(
        document.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
    ).filter((element) => {
        if (popover?.contains(element)) return false;
        let node: HTMLElement | null = element;
        while (node) {
            const nodeStyle = getComputedStyle(node);
            if (nodeStyle.display === 'none' || nodeStyle.visibility === 'hidden') return false;
            node = node.parentElement;
        }
        return true;
    });
    const triggerIndex = focusable.indexOf(trigger);
    if (triggerIndex < 0 || focusable.length === 0) {
        trigger.focus();
        return;
    }
    const nextIndex = (triggerIndex + (backward ? -1 : 1) + focusable.length) % focusable.length;
    focusable[nextIndex]?.focus();
};

export const trapDialogTabKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
    ).filter((element) => {
        if (element.tabIndex < 0) return false;
        if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
        let node: HTMLElement | null = element;
        while (node && node !== event.currentTarget) {
            const style = getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            node = node.parentElement;
        }
        return true;
    });
    if (!focusable.length) return;
    const active = document.activeElement;
    const activeIndex = focusable.indexOf(active as HTMLElement);
    const nextIndex =
        activeIndex < 0
            ? event.shiftKey
                ? focusable.length - 1
                : 0
            : (activeIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
    event.preventDefault();
    focusable[nextIndex]?.focus();
};

export const useAnchoredPopover = (
    open: boolean,
    anchorRef: RefObject<HTMLElement | null>,
    preferredWidth?: number,
) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
    useLayoutEffect(() => {
        if (!open) return;
        const update = () => {
            const anchor = anchorRef.current;
            if (!anchor) return;
            const anchorRect = anchor.getBoundingClientRect();
            const naturalHeight = popoverRef.current?.scrollHeight ?? 0;
            const { left, top, width, maxHeight } = getAnchoredPopoverGeometry({
                anchor: anchorRect,
                naturalHeight,
                preferredWidth,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            });
            setStyle({
                position: 'fixed',
                top,
                left,
                zIndex: 2147483647,
                width,
                maxWidth: 'calc(100vw - 16px)',
                maxHeight,
                overflowY: 'auto',
                visibility: 'visible',
            });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [anchorRef, open, preferredWidth]);
    return { popoverRef, style };
};

export const StyledSelect = ({
    label,
    value,
    options,
    onChange,
    name,
    className = '',
    disabled = false,
    popoverWidth,
}: {
    label: string;
    value: string | number;
    options: Array<{ value: string | number; label: string }>;
    onChange: (value: string) => void;
    name?: string;
    className?: string;
    disabled?: boolean;
    popoverWidth?: number;
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const { popoverRef, style } = useAnchoredPopover(open, triggerRef, popoverWidth);
    const selected = options.find((option) => String(option.value) === String(value)) ?? options[0];
    const closeAndFocusTrigger = useCallback(() => {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);
    const closeAndMoveFocus = useCallback(
        (backward: boolean) => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            setOpen(false);
            requestAnimationFrame(() => focusRelativeToTrigger(trigger, popoverRef.current, backward));
        },
        [popoverRef],
    );
    useLayoutEffect(() => {
        if (!open) return;
        const selectedOption = popoverRef.current?.querySelector<HTMLButtonElement>(
            '[role="option"][aria-selected="true"]',
        );
        const firstOption = popoverRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
        (selectedOption ?? firstOption)?.focus();
    }, [open, popoverRef]);
    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
            if (
                event instanceof MouseEvent &&
                (ref.current?.contains(event.target as Node) || popoverRef.current?.contains(event.target as Node))
            )
                return;
            if (event instanceof KeyboardEvent) closeAndFocusTrigger();
            else setOpen(false);
        };
        const closeWhenFocusLeaves = (event: FocusEvent) => {
            const target = event.target as Node;
            if (ref.current?.contains(target) || popoverRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        document.addEventListener('focusin', closeWhenFocusLeaves);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
            document.removeEventListener('focusin', closeWhenFocusLeaves);
        };
    }, [closeAndFocusTrigger, open, popoverRef]);
    return (
        <div className={`styled-select ${className}`} ref={ref}>
            {name && <input type="hidden" name={name} value={value} />}
            <button
                ref={triggerRef}
                type="button"
                className="styled-select-trigger"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={disabled}
                onClick={() => !disabled && setOpen(!open)}
                onKeyDownCapture={(event) => {
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                    event.preventDefault();
                    if (!disabled) setOpen(true);
                }}
            >
                <span>{selected?.label}</span>
                <span className="styled-select-chevron" aria-hidden="true" />
            </button>
            {open &&
                !disabled &&
                createPortal(
                    <div
                        className={`styled-select-menu styled-select-popover ${className ? `${className}-menu` : ''}`}
                        role="listbox"
                        aria-label={label}
                        ref={popoverRef}
                        style={style}
                        onBlur={(event) => {
                            const next = event.relatedTarget as Node | null;
                            if (next && (event.currentTarget.contains(next) || ref.current?.contains(next))) return;
                            setOpen(false);
                        }}
                        onKeyDown={(event) => {
                            const optionButtons = Array.from(
                                event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
                            );
                            const currentIndex = optionButtons.indexOf(document.activeElement as HTMLButtonElement);
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                event.stopPropagation();
                                closeAndFocusTrigger();
                                return;
                            }
                            if (event.key === 'Tab') {
                                event.preventDefault();
                                event.stopPropagation();
                                closeAndMoveFocus(event.shiftKey);
                                return;
                            }
                            let nextIndex: number | undefined;
                            if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % optionButtons.length;
                            if (event.key === 'ArrowUp')
                                nextIndex = (currentIndex - 1 + optionButtons.length) % optionButtons.length;
                            if (event.key === 'Home') nextIndex = 0;
                            if (event.key === 'End') nextIndex = optionButtons.length - 1;
                            if (nextIndex === undefined || !optionButtons.length) return;
                            event.preventDefault();
                            optionButtons[nextIndex]?.focus();
                        }}
                    >
                        {options.map((option) => (
                            <button
                                type="button"
                                role="option"
                                tabIndex={-1}
                                aria-selected={String(option.value) === String(value)}
                                key={option.value}
                                onClick={() => {
                                    onChange(String(option.value));
                                    closeAndFocusTrigger();
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export const Modal = ({
    title,
    onClose,
    children,
    closeDisabled = false,
    returnFocusTo,
    className,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    closeDisabled?: boolean;
    returnFocusTo?: HTMLElement | null;
    className?: string;
}) => {
    const dialogRef = useRef<HTMLElement>(null);
    const openerRef = useRef<HTMLElement | null>(returnFocusTo ?? null);
    useLayoutEffect(() => {
        if (!openerRef.current) openerRef.current = document.activeElement as HTMLElement | null;
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
        return () => {
            const opener = openerRef.current;
            if (opener?.isConnected) requestAnimationFrame(() => opener.focus());
        };
    }, []);
    return createPortal(
        <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => event.target === event.currentTarget && !closeDisabled && onClose()}
        >
            <section
                ref={dialogRef}
                className={['modal', className].filter(Boolean).join(' ')}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && !closeDisabled) {
                        event.preventDefault();
                        onClose();
                        return;
                    }
                    trapDialogTabKey(event);
                }}
            >
                <header>
                    <h2 id="modal-title">{title}</h2>
                    <button type="button" aria-label="Закрыть" disabled={closeDisabled} onClick={onClose}>
                        ×
                    </button>
                </header>
                {children}
            </section>
        </div>,
        document.body,
    );
};
