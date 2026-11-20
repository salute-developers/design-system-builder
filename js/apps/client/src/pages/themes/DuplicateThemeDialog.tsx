import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { trapDialogTabKey } from '../../components/Overlay/Overlay';
import { Visible } from '../../components/rendering';
import { themesApi } from '../../modules/themes/data/themesApi';
import type { ThemeTenant } from '../../modules/themes/domain/theme';
import { normalizeThemeName, validateThemeName } from '../../modules/themes/domain/themeProfiles';
import { getCreateThemeError } from './createThemeError';

/** Название копии по умолчанию. */
export const duplicateName = (name: string) => `${name} копия`;

/** Окно копирования темы: название копии и переход в неё после создания. */
export const DuplicateThemeDialog = ({
    projectId,
    theme,
    onClose,
    onCreated,
}: {
    projectId: string;
    theme: ThemeTenant;
    onClose: () => void;
    /** Что делать с копией; по умолчанию она открывается в редакторе. */
    onCreated?: (copy: ThemeTenant) => void;
}) => {
    const navigate = useNavigate();
    const dialogRef = useRef<HTMLElement>(null);
    const [name, setName] = useState(() => duplicateName(theme.name));
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const input = dialogRef.current?.querySelector<HTMLInputElement>('input');
        input?.focus();
        input?.select();
    }, []);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalized = normalizeThemeName(name);
        const invalid = validateThemeName(normalized);
        if (invalid) return setError(invalid);
        setBusy(true);
        setError('');
        try {
            const copy = await themesApi.duplicate(projectId, theme.designSystemId, theme.id, normalized);
            if (onCreated) onCreated(copy);
            else navigate(`/projects/${projectId}/design-systems/${copy.designSystemId}/themes/${copy.id}/overview`);
        } catch (failure) {
            setError(getCreateThemeError(failure));
            setBusy(false);
        }
    };
    return (
        <div className="catalog-dialog-scrim">
            <section
                ref={dialogRef}
                className={`create-project-dialog duplicate-theme-dialog is-project ${error ? 'has-error is-negative' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="duplicate-theme-title"
                onKeyDownCapture={(event) => {
                    if (event.key === 'Escape' && !busy) onClose();
                    trapDialogTabKey(event);
                }}
            >
                <form onSubmit={submit} noValidate>
                    <div className="create-project-main">
                        <header className="create-project-header">
                            <h1 id="duplicate-theme-title">Дублировать тему {theme.name}</h1>
                        </header>
                        <div className="create-project-details">
                            <label className="create-project-field">
                                <span>Название копии</span>
                                <input
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    maxLength={255}
                                    autoComplete="off"
                                    aria-invalid={Boolean(error)}
                                />
                                <Visible when={Boolean(error)}>
                                    <small role="alert">{error}</small>
                                </Visible>
                            </label>
                            <p className="create-project-hint">
                                Копия получит значения всех токенов, палитру и профиль. Дальше темы меняются независимо.
                            </p>
                        </div>
                    </div>
                    <footer>
                        <button type="button" className="secondary" onClick={onClose} disabled={busy}>
                            Отмена
                        </button>
                        <button type="submit" className="primary" disabled={busy || !name.trim()}>
                            {busy ? 'Копируем…' : 'Дублировать'}
                        </button>
                    </footer>
                </form>
            </section>
        </div>
    );
};
