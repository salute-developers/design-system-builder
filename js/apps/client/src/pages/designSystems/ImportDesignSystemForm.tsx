import type { ChangeEvent, FormEvent } from 'react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api';
import { choose } from '../../components/rendering';
import { importThemeFile } from '../../modules/designSystems/application/importThemeFile';
import { readThemeFile } from '../../modules/designSystems/application/themeFile';
import type { ImportedDesignSystem, ThemeFile } from '../../modules/designSystems/domain/designSystem';

const importErrorText = (error: unknown) => {
    if (!(error instanceof ApiError)) return 'Не удалось импортировать дизайн-систему.';
    if (error.status === 403) return 'Недостаточно прав для импорта в этот проект.';
    if (error.status === 409) return 'Конфликт при создании: попробуйте другое название.';
    if (error.status === 400) return 'Файл темы не прошёл проверку: исправьте файл и попробуйте снова.';
    return 'Не удалось импортировать дизайн-систему.';
};

/** Импорт дизайн-системы из файла темы в проект [projectId]. */
export const ImportDesignSystemForm = ({
    projectId,
    projectName,
    onImported,
}: {
    projectId: string;
    projectName: string;
    onImported: (result: ImportedDesignSystem) => void;
}) => {
    const [file, setFile] = useState<ThemeFile | null>(null);
    const [fileName, setFileName] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [reading, setReading] = useState(false);
    const [result, setResult] = useState<ImportedDesignSystem | null>(null);
    // Номер последнего выбора — страховка к блокировке поля: результат прежнего чтения не должен подменить новый.
    const latestRead = useRef(0);

    const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0];
        const read = ++latestRead.current;
        setFile(null);
        setError('');
        setFileName(selected?.name ?? '');
        if (!selected) return;
        setReading(true);
        try {
            const themeFile = await readThemeFile(selected);
            if (read !== latestRead.current) return;
            setFile(themeFile);
            setName(themeFile.meta.name);
        } catch {
            if (read !== latestRead.current) return;
            setError('Не удалось прочитать файл: нужен .zip сборки темы или .json данных темы.');
        } finally {
            if (read === latestRead.current) setReading(false);
        }
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalizedName = name.trim();
        if (!file) return setError('Выберите файл темы.');
        if (!normalizedName) return setError('Введите название Design System.');
        setBusy(true);
        setError('');
        try {
            const imported = await importThemeFile(projectId, projectName || normalizedName, normalizedName, file);
            if (imported.skippedTokens.length === 0) return onImported(imported);
            setResult(imported);
        } catch (failure) {
            setError(importErrorText(failure));
            setBusy(false);
        }
    };

    if (result)
        return (
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onImported(result);
                }}
            >
                <header>
                    <h1 id="create-design-system-title">Дизайн-система импортирована</h1>
                    <p>
                        Значения {result.skippedTokens.length} токенов не записаны: таких токенов нет в дизайн-системе.
                    </p>
                </header>
                <p className="create-design-system-skipped">{result.skippedTokens.join(', ')}</p>
                <footer>
                    <button type="submit" className="primary">
                        Открыть дизайн-систему
                    </button>
                </footer>
            </form>
        );

    return (
        <form onSubmit={submit} noValidate>
            <header>
                <h1 id="create-design-system-title">Импортировать дизайн-систему</h1>
                <p>Дизайн-система будет создана из файла темы внутри проекта {projectName}.</p>
            </header>
            <label className="create-design-system-field">
                <span>Файл темы</span>
                <span
                    className={choose(
                        reading || busy,
                        'create-design-system-file',
                        'create-design-system-file is-disabled',
                    )}
                >
                    <input
                        type="file"
                        name="themeFile"
                        accept=".zip,.json,application/json,application/zip"
                        onChange={(event) => void chooseFile(event)}
                        // Пока файл читается, второй выбор не даём: чтение zip заметно дольше чтения json.
                        disabled={reading || busy}
                        aria-label="Файл темы"
                    />
                    <span className={choose(Boolean(fileName), 'is-placeholder', '')}>
                        {choose(reading, fileName || 'Файл .zip или .json', `Читаем ${fileName}…`)}
                    </span>
                    <span className="create-design-system-file-action" aria-hidden="true">
                        Выбрать
                    </span>
                </span>
            </label>
            <label className="create-design-system-field">
                <span>Название</span>
                <input
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={255}
                    autoComplete="off"
                    placeholder="Название дизайн-системы"
                    disabled={!file}
                    aria-invalid={Boolean(error)}
                />
                {error && <small role="alert">{error}</small>}
            </label>
            <footer>
                <Link className="secondary" to={`/projects/${projectId}`}>
                    Отмена
                </Link>
                <button type="submit" className="primary" disabled={busy || reading || !file || !name.trim()}>
                    {choose(busy, 'Импортировать', 'Импортируем…')}
                </button>
            </footer>
        </form>
    );
};
