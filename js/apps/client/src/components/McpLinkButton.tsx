import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPopover } from './Overlay/Overlay';
import { Button } from '../pages/versionJournal/VersionJournalPages.styles';

export const McpLinkButton = ({ projectId, designSystemId, version }: {
    projectId: string; designSystemId: string; version: string;
}) => {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const trigger = useRef<HTMLButtonElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const id = useId();
    const { popoverRef, style } = useAnchoredPopover(open, trigger, 440);
    const link = `dsbuilder://projects/${encodeURIComponent(projectId)}/design-systems/${encodeURIComponent(designSystemId)}?${new URLSearchParams({ version })}`;
    useEffect(() => { setMessage(''); }, [link, open]);
    useEffect(() => {
        if (!open) return;
        input.current?.focus();
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent) {
                if (event.key !== 'Escape') return;
                trigger.current?.focus();
            } else if (trigger.current?.contains(event.target as Node) || popoverRef.current?.contains(event.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open, popoverRef]);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setMessage('Ссылка скопирована');
        } catch {
            input.current?.focus();
            input.current?.select();
            setMessage('Не удалось скопировать. Скопируйте выделенную ссылку вручную.');
        }
    };
    return <>
        <Button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open}
            aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>MCP</Button>
        {open && createPortal(
            <div ref={popoverRef} id={id} role="dialog" aria-label="Ссылка для MCP" className="mcp-link-popover" style={style}>
                <p>Укажите агенту эту ссылку для работы с текущей дизайн-системой.</p>
                <div className="mcp-link-field">
                    <input ref={input} aria-label="Ссылка на дизайн-систему для MCP" readOnly value={link} />
                    <Button type="button" onClick={copy}>Копировать</Button>
                </div>
                <span role="status">{message}</span>
            </div>, document.body,
        )}
    </>;
};
