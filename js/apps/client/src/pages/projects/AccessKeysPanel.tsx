import { IconCopyOutline } from '@salutejs/plasma-icons';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { projectsApi } from '../../api';
import { Modal, StyledSelect } from '../../components/Overlay/Overlay';
import { PROJECT_ACCESS_KEY_EXPIRY_OPTIONS, PROJECT_ACCESS_KEY_SCOPES } from '../../modules/projects/domain/accessKeys';
import { useLoad } from '../../shared/data/useLoad';

export const AccessKeysPanel = ({
    projectId,
    onActiveCount,
}: {
    projectId: string;
    onActiveCount: (count: number) => void;
}) => {
    const keys = useLoad(() => projectsApi.accessKeys(projectId), [projectId], `access-keys:${projectId}`);
    const [name, setName] = useState('');
    const [ttlSeconds, setTtlSeconds] = useState(90 * 24 * 60 * 60);
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [scopes, setScopes] = useState<string[]>(['projects:read']);
    const activeKeys = (keys.data ?? []).filter((key) => !key.revokedAt);
    useEffect(() => onActiveCount(activeKeys.length), [activeKeys.length, onActiveCount]);
    const create = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!name.trim()) return setError('Введите название ключа.');
        if (!scopes.length) return setError('Выберите хотя бы один scope.');
        setBusy('create');
        setError('');
        try {
            const created = await projectsApi.createAccessKey(projectId, {
                name: name.trim(),
                scopes,
                ttlSeconds,
            });
            setSecret(created.secret);
            setName('');
            setCreateOpen(false);
            keys.reload();
        } catch {
            setError('Не удалось создать ключ.');
        } finally {
            setBusy('');
        }
    };
    if (keys.error)
        return (
            <section className="cli-access-settings">
                <p className="ps-block-title">CLI-доступ</p>
                <div className="ps-error-notice" role="alert">
                    <span>Не удалось загрузить ключи.</span>
                    <button type="button" className="ps-button ps-button-neutral" onClick={keys.reload}>
                        Повторить
                    </button>
                </div>
            </section>
        );
    return (
        <section className="cli-access-settings" aria-labelledby="cli-access-heading">
            <p className="ps-block-title">CLI-доступ</p>
            <h2 id="cli-access-heading" className="ps-subtitle">
                Доступ к опубликованным версиям из CI/CD
            </h2>
            <p className="ps-hint">Создайте ключ только для чтения, чтобы загружать опубликованные версии проекта.</p>
            <div className="ps-cli-heading-row">
                <p className="ps-hint">{keys.data ? `${activeKeys.length} активных ключей` : 'Загружаем ключи…'}</p>
                <button type="button" className="ps-button ps-button-primary" onClick={() => setCreateOpen(true)}>
                    Создать ключ
                </button>
            </div>
            {secret ? (
                <div className="ps-cli-created" role="status">
                    <strong className="ps-cli-created-title">
                        Сохраните этот ключ. Он отображается всего один раз.
                    </strong>
                    <div className="ps-cli-secret-row">
                        <code>{secret}</code>
                        <button
                            type="button"
                            className="ps-icon-button ps-cli-copy-button"
                            aria-label="Копировать ключ"
                            title="Копировать ключ"
                            onClick={() => void navigator.clipboard?.writeText(secret)}
                        >
                            <IconCopyOutline color="inherit" size="xs" />
                        </button>
                    </div>
                </div>
            ) : null}
            {createOpen && (
                <Modal
                    title="Создать ключ доступа"
                    className="ps-access-key-dialog"
                    onClose={() => setCreateOpen(false)}
                >
                    <form className="ps-access-key-modal" onSubmit={create}>
                        <div className="ps-access-key-modal-body">
                            <label className="ps-label">
                                Название
                                <input
                                    className="ps-field"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Например, CI production"
                                    maxLength={80}
                                />
                            </label>
                            <label className="ps-label">
                                Срок действия
                                <StyledSelect
                                    label="Срок действия"
                                    value={ttlSeconds}
                                    onChange={(value) => setTtlSeconds(Number(value))}
                                    options={PROJECT_ACCESS_KEY_EXPIRY_OPTIONS}
                                />
                            </label>
                            <fieldset className="ps-scope-picker">
                                <legend>Scopes</legend>
                                <p>Выберите минимально необходимые разрешения.</p>
                                <div className="ps-scope-options">
                                    {PROJECT_ACCESS_KEY_SCOPES.map((scope) => (
                                        <label className="ps-scope-option" key={scope}>
                                            <input
                                                type="checkbox"
                                                checked={scopes.includes(scope)}
                                                onChange={(e) =>
                                                    setScopes(
                                                        e.target.checked
                                                            ? [...scopes, scope]
                                                            : scopes.filter((item) => item !== scope),
                                                    )
                                                }
                                            />
                                            <span>
                                                <strong>{scope}</strong>
                                                <small>
                                                    {scope.endsWith(':read')
                                                        ? 'Просмотр данных'
                                                        : scope.endsWith(':write')
                                                          ? 'Изменение данных'
                                                          : 'Удаление данных'}
                                                </small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            {error && (
                                <p className="form-error" role="alert">
                                    {error}
                                </p>
                            )}
                        </div>
                        <footer>
                            <button
                                type="button"
                                className="ps-button ps-button-neutral"
                                onClick={() => setCreateOpen(false)}
                            >
                                Отмена
                            </button>
                            <button className="ps-button ps-button-primary" disabled={busy === 'create'}>
                                {busy === 'create' ? 'Создаём…' : 'Создать ключ'}
                            </button>
                        </footer>
                    </form>
                </Modal>
            )}
            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
            {activeKeys.length > 0 && (
                <div className="ps-cli-list">
                    <div className="ps-cli-head" aria-hidden="true">
                        <span>Название</span>
                        <span>Статус</span>
                        <span>Scopes</span>
                        <span>Срок действия</span>
                        <span>Действия</span>
                    </div>
                    {activeKeys.map((key) => (
                        <div className="ps-cli-row" key={key.id}>
                            <strong>{key.name}</strong>
                            <span>Активен</span>
                            <div className="ps-scope-flow">
                                {key.scopes.map((scope) => (
                                    <span className="ps-scope-chip" key={scope}>
                                        {scope}
                                    </span>
                                ))}
                            </div>
                            <span>
                                {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString('ru-RU') : 'Без срока'}
                            </span>
                            <button
                                type="button"
                                className="ps-button ps-button-danger"
                                disabled={busy === key.id}
                                onClick={async () => {
                                    setBusy(key.id);
                                    setError('');
                                    try {
                                        await projectsApi.revokeAccessKey(projectId, key.id);
                                        keys.reload();
                                    } catch {
                                        setError('Не удалось отозвать ключ.');
                                    } finally {
                                        setBusy('');
                                    }
                                }}
                            >
                                {busy === key.id ? 'Отзываем…' : 'Отозвать'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};
