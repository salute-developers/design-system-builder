import { useState } from 'react';

import {
    NAME_PREFIX,
    newTokenNames,
    normalizeTokenName,
    SECTION_LABELS,
    sizeLabel,
    spacingNameFromValue,
    type SizeTokenKind,
} from '../../../modules/sizeTokens';

interface NewTokenDialogProps {
    kind: SizeTokenKind;
    /** Самый крупный размер тени, с которого копируются слои. */
    shadowSource: string | null;
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onCreate: (input: { name: string; value: string }) => void;
}

/** Окно «Новый токен» — разметка окна цветов прототипа (`customTokenModal`). */
export const NewSizeTokenDialog = ({ kind, shadowSource, busy, error, onCancel, onCreate }: NewTokenDialogProps) => {
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [nameTouched, setNameTouched] = useState(false);
    const label = SECTION_LABELS[kind];
    const nameField = (
        <label className="source-palette-group-field">
            <span>{kind === 'shadow' ? 'Размер' : 'Имя токена'}</span>
            <input
                autoFocus={kind !== 'spacing'}
                value={name}
                placeholder={kind === 'shadow' ? 'Например, xl' : kind === 'spacing' ? '14x' : 'Например, xxxl'}
                aria-label={kind === 'shadow' ? 'Размер' : 'Имя токена'}
                onChange={(event) => {
                    setName(event.target.value);
                    setNameTouched(true);
                }}
            />
        </label>
    );
    const valueField = (
        <label className="source-palette-group-field">
            <span>Значение, px</span>
            <input
                autoFocus={kind === 'spacing'}
                value={value}
                inputMode="numeric"
                placeholder={kind === 'spacing' ? '28' : '40'}
                aria-label="Значение, px"
                onChange={(event) => {
                    setValue(event.target.value);
                    // Имя отступа подставляется из значения по правилу темы, пока пользователь не изменил его сам.
                    if (kind === 'spacing' && !nameTouched) setName(spacingNameFromValue(event.target.value));
                }}
            />
        </label>
    );
    const shadowNames = newTokenNames('shadow', normalizeTokenName(name) || '<размер>');
    return (
        <div className="modal-backdrop custom-token-backdrop">
            <section
                className="entity-modal custom-token-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-size-token-title"
            >
                <header>
                    <div>
                        <span>{label}</span>
                        <h2 id="new-size-token-title">Новый токен</h2>
                    </div>
                    <button
                        type="button"
                        className="source-palette-modal-close"
                        aria-label="Закрыть"
                        onClick={onCancel}
                    >
                        ×
                    </button>
                </header>
                <div
                    className="custom-token-form"
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !busy)
                            onCreate({ name, value });
                    }}
                >
                    {kind === 'shadow' ? (
                        <>
                            <p>
                                Тень создаётся сразу в четырёх вариантах. Слои копируются с самого крупного размера
                                {shadowSource ? ` (${sizeLabel(shadowSource)})` : ''}, их можно изменить после создания.
                            </p>
                            {nameField}
                            <ul className="st-names" data-testid="new-shadow-names">
                                {shadowNames.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <>
                            <p>
                                Токен появится в разделе {label} с префиксом {NAME_PREFIX[kind]} и встанет в шкалу по
                                значению.
                            </p>
                            {kind === 'spacing' && valueField}
                            {nameField}
                            {kind === 'radius' && valueField}
                        </>
                    )}
                    {error && (
                        <p className="custom-token-error" role="alert">
                            {error}
                        </p>
                    )}
                </div>
                <footer>
                    <button type="button" className="secondary" onClick={onCancel}>
                        Отмена
                    </button>
                    <button type="button" disabled={busy} onClick={() => onCreate({ name, value })}>
                        Создать токен
                    </button>
                </footer>
            </section>
        </div>
    );
};

interface DeleteDialogProps {
    /** Над заголовком: имя токена или «тень M». */
    title: string;
    /** Имена удаляемых токенов: у тени — четыре варианта размера. */
    names: string[];
    components: string[];
    busy: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Подтверждение удаления токена, который используют компоненты, — по образцу `DeleteTokenDialog` «Цветов». */
export const DeleteSizeTokenDialog = ({
    title,
    names,
    components,
    busy,
    error,
    onCancel,
    onConfirm,
}: DeleteDialogProps) => (
    <div className="modal-backdrop custom-token-backdrop">
        <section
            className="entity-modal custom-token-modal delete-token-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-size-token-title"
        >
            <header>
                <div>
                    <span>{title}</span>
                    <h2 id="delete-size-token-title">Удалить токен?</h2>
                </div>
                <button type="button" className="source-palette-modal-close" aria-label="Закрыть" onClick={onCancel}>
                    ×
                </button>
            </header>
            <div className="custom-token-form">
                <p data-testid="delete-size-token-names">
                    {names.length > 1 ? `Удалятся токены ${names.join(', ')}` : 'Токен удалится из дизайн-системы'}{' '}
                    вместе со значениями во всех темах. Удаление нельзя отменить.
                </p>
                <p data-testid="delete-size-token-components">
                    Используется в компонентах: {components.join(', ')}. Ссылки компонентов на токен будут сброшены.
                </p>
                {error && (
                    <p className="custom-token-error" role="alert">
                        {error}
                    </p>
                )}
            </div>
            <footer>
                <button type="button" className="secondary" onClick={onCancel}>
                    Отмена
                </button>
                <button type="button" disabled={busy} onClick={onConfirm}>
                    Удалить токен
                </button>
            </footer>
        </section>
    </div>
);
