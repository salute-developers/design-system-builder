import { useState } from 'react';
import styled from 'styled-components';

import { Modal } from '../../../components/Overlay/Overlay';
import {
    fromLegacyValue,
    iconAssetUrl,
    toLegacyValue,
    type IconCatalog,
    type IconEntry,
    type IconSize,
} from '../domain/iconCatalog';
import { IconBrowser } from './IconBrowser';
import { IconMask } from './IconMask';

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const Row = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const Trigger = styled.button`
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--p-line, rgba(128, 128, 128, 0.4));
    border-radius: 10px;
    background: var(--p-surface, transparent);
    color: var(--p-text, inherit);
    font: inherit;
    text-align: left;
    cursor: pointer;
`;

const Value = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const Note = styled.span`
    font-size: 12px;
    color: var(--p-muted, inherit);
`;

const Link = styled.button`
    border: 0;
    background: none;
    padding: 0;
    color: var(--p-accent, inherit);
    font: inherit;
    cursor: pointer;
`;

export interface IconPickerProps {
    label: string;
    value?: string;
    /** `undefined` — каталог ещё не загружен или недоступен: значение показывается строкой. */
    catalog?: IconCatalog;
    onChange: (value: string) => void;
    /** Без обработчика кнопка «Очистить» не показывается (значение не задано в источнике). */
    onClear?: () => void;
}

/** Выбор иконки свойства из каталога. Значение хранится строкой старого формата (`disclosure.down.fill.16`). */
export const IconPicker = ({ label, value, catalog, onChange, onClear }: IconPickerProps) => {
    const [open, setOpen] = useState(false);
    const hasCatalog = Boolean(catalog && catalog.icons.length > 0);
    const resolved = catalog ? fromLegacyValue(value, catalog) : undefined;

    const select = (icon: IconEntry, size: IconSize) => {
        onChange(toLegacyValue(icon, size));
        setOpen(false);
    };

    return (
        <Field>
            <span>{label}</span>
            <Row>
                <Trigger
                    type="button"
                    disabled={!hasCatalog}
                    aria-label={`${label}: выбрать иконку`}
                    onClick={() => setOpen(true)}
                >
                    {resolved && catalog ? (
                        <>
                            <IconMask url={iconAssetUrl(catalog, resolved.icon.name, resolved.size)} size={resolved.size} />
                            <Value>
                                {resolved.icon.name} · {resolved.size}
                            </Value>
                        </>
                    ) : (
                        <Value>{value || (hasCatalog ? 'Выбрать иконку' : '')}</Value>
                    )}
                </Trigger>
                {value && onClear ? (
                    <Link type="button" onClick={onClear}>
                        Очистить
                    </Link>
                ) : null}
            </Row>
            {value && hasCatalog && !resolved ? <Note>нет в каталоге</Note> : null}
            {open && catalog ? (
                <Modal title="Выбор иконки" onClose={() => setOpen(false)}>
                    <IconBrowser
                        catalog={catalog}
                        initialSize={resolved?.size}
                        selectedName={resolved?.icon.name}
                        onSelect={select}
                        gridHeight={420}
                    />
                </Modal>
            ) : null}
        </Field>
    );
};
