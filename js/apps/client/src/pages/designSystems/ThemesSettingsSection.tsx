import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { themesApi } from '../../modules/themes/data/themesApi';
import type { ThemeProfile, ThemeTenant } from '../../modules/themes/domain/theme';
import { normalizeThemeName, themeProfileLabels } from '../../modules/themes/domain/themeProfiles';
import { DuplicateThemeDialog } from '../themes/DuplicateThemeDialog';
import { getCreateThemeError } from '../themes/createThemeError';

const nameError = (error: unknown) =>
    getCreateThemeError(error).replace('Не удалось создать тему', 'Не удалось переименовать тему');

/** Строка темы: название правится на месте, Enter или уход с поля сохраняет, Escape возвращает прежнее. */
const ThemeRow = ({
    projectId,
    theme,
    canWrite,
    canDelete,
    highlighted,
    focusName,
    confirmDelete,
    onDuplicate,
    onDeleted,
}: {
    projectId: string;
    theme: ThemeTenant;
    canWrite: boolean;
    canDelete: boolean;
    highlighted: boolean;
    focusName: boolean;
    confirmDelete: boolean;
    onDuplicate: () => void;
    onDeleted: () => void;
}) => {
    const [name, setName] = useState(theme.name);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(confirmDelete);
    const [confirmation, setConfirmation] = useState('');
    const [removing, setRemoving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    useEffect(() => setName(theme.name), [theme.name]);
    // Адрес прежней ссылки «Удалить» переписывается после первого рендера: подтверждение открывается и тогда.
    useEffect(() => {
        if (confirmDelete) setDeleting(true);
    }, [confirmDelete]);
    useEffect(() => {
        if (!highlighted) return;
        rowRef.current?.scrollIntoView?.({ block: 'nearest' });
        if (focusName) inputRef.current?.select();
    }, [highlighted, focusName]);

    const save = async () => {
        const normalized = normalizeThemeName(name);
        if (normalized === theme.name) return setName(theme.name);
        if (!normalized) {
            setError('Введите название Theme.');
            setName(theme.name);
            return;
        }
        setSaving(true);
        try {
            await themesApi.update(projectId, theme.id, { name: normalized }, theme.designSystemId);
            setError('');
        } catch (failure) {
            setError(nameError(failure));
            setName(theme.name);
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setRemoving(true);
        try {
            await themesApi.remove(projectId, theme.id, theme.designSystemId);
            onDeleted();
        } catch {
            setError('Не удалось удалить тему. Повторите попытку.');
            setRemoving(false);
        }
    };

    const editorPath = `/projects/${projectId}/design-systems/${theme.designSystemId}/themes/${theme.id}/colors`;
    return (
        <div ref={rowRef} className={`ds-theme-row ${highlighted ? 'is-highlighted' : ''}`} data-theme-id={theme.id}>
            <div className="ds-theme-main">
                <span className="theme-switcher-swatch" aria-hidden="true">
                    <span style={{ background: theme.preview.surfaceLight }}>
                        <i style={{ background: theme.preview.accentLight }} />
                    </span>
                    <span style={{ background: theme.preview.surfaceDark }}>
                        <i style={{ background: theme.preview.accentDark }} />
                    </span>
                </span>
                {canWrite ? (
                    <input
                        ref={inputRef}
                        className="ps-field ds-theme-name"
                        aria-label={`Название темы ${theme.name}`}
                        value={name}
                        disabled={saving}
                        maxLength={80}
                        aria-invalid={Boolean(error)}
                        onChange={(event) => {
                            setName(event.target.value);
                            setError('');
                        }}
                        onBlur={() => void save()}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                            if (event.key === 'Escape') {
                                event.stopPropagation();
                                setName(theme.name);
                                setError('');
                                requestAnimationFrame(() => inputRef.current?.blur());
                            }
                        }}
                    />
                ) : (
                    <span className="ds-theme-name is-static">{theme.name}</span>
                )}
                <span className="ds-theme-profile">
                    {themeProfileLabels[theme.colorConfig.profile as ThemeProfile] ?? 'Custom'}
                </span>
                <Link className="ps-button ps-button-neutral" to={editorPath}>
                    Открыть
                </Link>
                {canWrite && (
                    <button type="button" className="ps-button ps-button-neutral" onClick={onDuplicate}>
                        Дублировать
                    </button>
                )}
                {canDelete && (
                    <button
                        type="button"
                        className="ps-button ps-button-neutral ds-theme-delete"
                        aria-expanded={deleting}
                        onClick={() => {
                            setDeleting(!deleting);
                            setConfirmation('');
                        }}
                    >
                        Удалить
                    </button>
                )}
            </div>
            {error && (
                <p className="form-error ds-theme-error" role="alert">
                    {error}
                </p>
            )}
            {deleting && canDelete && (
                <div className="ds-theme-confirm">
                    <p className="ps-danger-confirm">
                        Тема и её значения будут удалены. Введите {theme.name} для подтверждения
                    </p>
                    <div className="ps-danger-actions">
                        <input
                            className="ps-field"
                            aria-label={`Подтверждение удаления темы ${theme.name}`}
                            value={confirmation}
                            autoFocus
                            onChange={(event) => setConfirmation(event.target.value)}
                        />
                        <button
                            type="button"
                            className="ps-button ps-button-danger"
                            disabled={removing || confirmation !== theme.name}
                            onClick={() => void remove()}
                        >
                            {removing ? 'Удаляем…' : 'Удалить тему'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Раздел «Темы» настроек дизайн-системы: все темы с переименованием, дублированием и удалением. Права ограничивают
 * действия; без права записи список только для чтения.
 */
export const ThemesSettingsSection = ({
    projectId,
    designSystemId,
    themes,
    canWrite,
    canDelete,
    highlightedId,
    focusName,
    confirmDeleteId,
    openTenantId,
}: {
    projectId: string;
    designSystemId: string;
    themes: ThemeTenant[];
    canWrite: boolean;
    canDelete: boolean;
    highlightedId?: string | null;
    focusName?: boolean;
    confirmDeleteId?: string | null;
    /** Тема, открытая в редакторе: после её удаления редактор переходит к другой теме. */
    openTenantId?: string;
}) => {
    const navigate = useNavigate();
    const [, setParams] = useSearchParams();
    const [duplicating, setDuplicating] = useState<ThemeTenant | null>(null);
    /** Копия из настроек остаётся в списке и выделяется. */
    const showCopy = (copy: ThemeTenant) => {
        setDuplicating(null);
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.set('section', 'themes');
                next.set('theme', copy.id);
                next.delete('confirm');
                next.delete('focus');
                return next;
            },
            { replace: true },
        );
    };
    const afterDelete = (deleted: ThemeTenant) => {
        if (deleted.id !== openTenantId) return;
        const next = themes.find((theme) => theme.id !== deleted.id);
        navigate(
            next
                ? `/projects/${projectId}/design-systems/${designSystemId}/themes/${next.id}/settings?section=themes`
                : `/projects/${projectId}/design-systems/${designSystemId}`,
            { replace: true },
        );
    };
    return (
        <section id="settings-themes" className="settings-section ds-themes">
            {!themes.length && <p className="catalog-meta">В дизайн-системе нет тем.</p>}
            {themes.map((theme) => (
                <ThemeRow
                    key={theme.id}
                    projectId={projectId}
                    theme={theme}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    highlighted={theme.id === highlightedId}
                    focusName={Boolean(focusName) && theme.id === highlightedId}
                    confirmDelete={theme.id === confirmDeleteId}
                    onDuplicate={() => setDuplicating(theme)}
                    onDeleted={() => afterDelete(theme)}
                />
            ))}
            {!canWrite && themes.length > 0 && (
                <p className="catalog-meta">Переименовывать и дублировать темы может Editor, Maintainer или Owner.</p>
            )}
            {duplicating && (
                <DuplicateThemeDialog
                    projectId={projectId}
                    theme={duplicating}
                    onClose={() => setDuplicating(null)}
                    onCreated={showCopy}
                />
            )}
        </section>
    );
};
