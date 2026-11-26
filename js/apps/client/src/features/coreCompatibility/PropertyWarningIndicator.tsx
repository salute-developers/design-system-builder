import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPopover } from '../../components/Overlay/Overlay';
import { TyGlyph } from '../../components/TyGlyph';

export const CompatibilityHint = ({
    message,
    children,
    className,
    icon = false,
}: {
    message: string;
    children: ReactNode;
    className?: string;
    icon?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLSpanElement>(null);
    const tooltipId = useId();
    const { popoverRef, style } = useAnchoredPopover(open, anchorRef, 'content');
    const hint = message;

    return (
        <>
            <span
                ref={anchorRef}
                className={className}
                role={icon ? 'img' : undefined}
                aria-label={icon ? hint : undefined}
                aria-describedby={open ? tooltipId : undefined}
                tabIndex={0}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpen(false);
                }}
            >
                {children}
            </span>
            {open &&
                createPortal(
                    <div
                        ref={popoverRef}
                        id={tooltipId}
                        role="tooltip"
                        className="editor-autosave-tooltip"
                        style={{ ...style, maxWidth: 'min(320px, calc(100vw - 16px))' }}
                    >
                        {hint}
                    </div>,
                    document.body,
                )}
        </>
    );
};

export const PropertyWarningIndicator = ({ message, blocking = false }: { message: string; blocking?: boolean }) => (
    <CompatibilityHint icon message={message} className={`core-property-deprecated${blocking ? ' is-blocking' : ''}`}>
        <TyGlyph name="warning" />
    </CompatibilityHint>
);
