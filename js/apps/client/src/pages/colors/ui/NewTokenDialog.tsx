import { useState } from 'react';

import { SECTION_LABELS, normalizeNewToken, type ColorSection, type ColorTokenKey } from '../../../modules/colorTokens';

export interface CategoryOption {
    label: string;
    paletteGroupId: string | null;
    surfaceKind: 'Solid' | 'Transparent' | null;
}

interface NewTokenDialogProps {
    section: ColorSection;
    categories: CategoryOption[];
    defaults: { light: string; dark: string };
    existing: ReadonlySet<string>;
    busy: boolean;
    serverError: string | null;
    onCancel: () => void;
    onCreate: (input: {
        key: ColorTokenKey;
        displayName: string;
        light: string;
        dark: string;
        paletteGroupId: string | null;
    }) => void;
}

/** Окно «Новый токен» по `customTokenModal` прототипа; категория — группа палитры темы. */
export const NewTokenDialog = (props: NewTokenDialogProps) => {
    const { section, categories, defaults, existing, busy, serverError } = props;
    const label = SECTION_LABELS[section];
    const [category, setCategory] = useState(0);
    const [name, setName] = useState('');
    const [light, setLight] = useState(defaults.light);
    const [dark, setDark] = useState(defaults.dark);
    const [error, setError] = useState<string | null>(null);

    const submit = () => {
        if (busy) return;
        const selected = categories[category];
        const result = normalizeNewToken(
            { section, surfaceKind: selected?.surfaceKind ?? null, name, light: light.trim(), dark: dark.trim() },
            existing,
        );
        if ('error' in result) return setError(result.error);
        setError(null);
        props.onCreate({
            ...result,
            light: light.trim().toUpperCase(),
            dark: dark.trim().toUpperCase(),
            paletteGroupId: selected?.paletteGroupId ?? null,
        });
    };

    return (
        <div className="modal-backdrop custom-token-backdrop">
            <section
                className="entity-modal custom-token-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="custom-token-title"
            >
                <header>
                    <div>
                        <span>{label}</span>
                        <h2 id="custom-token-title">Новый токен</h2>
                    </div>
                    <button
                        type="button"
                        className="source-palette-modal-close"
                        aria-label="Закрыть"
                        onClick={props.onCancel}
                    >
                        ×
                    </button>
                </header>
                <div className="custom-token-form">
                    <p>
                        Токен появится в разделе {label} и получит его префикс в имени. Контексты OnDark, OnLight и
                        Inverse он унаследует от Light и Dark, как остальные токены темы.
                    </p>
                    <label className="source-palette-group-field">
                        <span>Категория</span>
                        <select value={category} onChange={(event) => setCategory(Number(event.target.value))}>
                            {categories.map((item, index) => (
                                <option key={item.label} value={index}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="source-palette-group-field">
                        <span>Имя токена</span>
                        <input
                            autoFocus
                            placeholder="Например, Highlight"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && submit()}
                        />
                    </label>
                    <div className="custom-token-values">
                        <label className="source-palette-group-field">
                            <span>Light</span>
                            <input value={light} onChange={(event) => setLight(event.target.value)} />
                        </label>
                        <label className="source-palette-group-field">
                            <span>Dark</span>
                            <input value={dark} onChange={(event) => setDark(event.target.value)} />
                        </label>
                    </div>
                    {(error ?? serverError) && (
                        <p className="custom-token-error" role="alert">
                            {error ?? serverError}
                        </p>
                    )}
                </div>
                <footer>
                    <button type="button" className="secondary" onClick={props.onCancel}>
                        Отмена
                    </button>
                    <button type="button" disabled={busy} onClick={submit}>
                        Создать токен
                    </button>
                </footer>
            </section>
        </div>
    );
};
