import { IconCopyOutline } from '@salutejs/plasma-icons';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { authService } from '../../api';
import { userSettingsApi, type TokenScope } from '../../modules/userSettings/data/userSettingsApi';
import { Modal, StyledSelect } from '../../components/Overlay/Overlay';
import { PERSONAL_ACCESS_TOKEN_EXPIRY_OPTIONS } from '../../modules/userSettings/domain/tokenExpiry';
import { useLoad } from '../../shared/data/useLoad';

export interface PersonalAccessTokenCounts {
    total: number;
    active: number;
    expired: number;
}

export const PersonalAccessTokensPanel = ({
    userId,
    onActiveCount,
    onCountsChange,
}: {
    userId: string;
    onActiveCount?: (count: number) => void;
    onCountsChange?: (counts: PersonalAccessTokenCounts) => void;
}) => {
    const keys = useLoad(() => userSettingsApi.tokens(), [userId], `personal-access-tokens:${userId}`);
    const catalog = useLoad(userSettingsApi.scopes, [userId], `pat-scopes:${userId}`);
    const [name, setName] = useState('');
    const [ttlSeconds, setTtlSeconds] = useState(90 * 24 * 60 * 60);
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [scopes, setScopes] = useState<string[]>(['projects:read']);
    const sessionGeneration = useRef(0);
    useEffect(() => {
        const unsubscribe = authService.onSessionReset(() => {
            sessionGeneration.current += 1;
            setSecret('');
            setBusy('');
            setError('');
            setCreateOpen(false);
        });
        return () => { sessionGeneration.current += 1; unsubscribe(); };
    }, []);
    const now = Date.now();
    const visibleKeys = (keys.data ?? []).filter((key) => !key.revokedAt);
    const activeKeys = visibleKeys.filter((key) => new Date(key.expiresAt).getTime() > now);
    useEffect(() => {
        onActiveCount?.(activeKeys.length);
        onCountsChange?.({
            total: visibleKeys.length,
            active: activeKeys.length,
            expired: visibleKeys.length - activeKeys.length,
        });
    }, [activeKeys.length, visibleKeys.length, onActiveCount, onCountsChange]);
    const availableScopes = catalog.data?.scopes ?? [];
    const scopeGroups = new Map<string, { title: string; scopes: TokenScope[] }>();
    for (const scope of availableScopes) {
        const groupId = scope.id.split(':')[0];
        const group: { title: string; scopes: TokenScope[] } = scopeGroups.get(groupId)
            ?? { title: scope.title.split(':')[0], scopes: [] };
        group.scopes.push(scope);
        scopeGroups.set(groupId, group);
    }
    const selectScopes = (ids: string[], checked: boolean) => {
        setScopes((current) => checked
            ? [...new Set([...current, ...ids])]
            : current.filter((scope) => !ids.includes(scope)));
    };
    const create = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!name.trim()) return setError('Введите название ключа.');
        if (!scopes.length) return setError('Выберите хотя бы один scope.');
        const generation = sessionGeneration.current;
        setBusy('create');
        setError('');
        try {
            const created = await userSettingsApi.create({
                name: name.trim(),
                scopes,
                ttlSeconds,
            });
            if (generation !== sessionGeneration.current) return;
            setSecret(created.secret);
            setName('');
            setCreateOpen(false);
            keys.reload();
        } catch {
            if (generation === sessionGeneration.current) setError('Не удалось создать ключ.');
        } finally {
            if (generation === sessionGeneration.current) setBusy('');
        }
    };
    if (keys.error || catalog.error)
        return (
            <section className="cli-access-settings">
                <p className="ps-block-title">Personal Access Token</p>
                <div className="ps-error-notice" role="alert">
                    <span>Не удалось загрузить ключи.</span>
                    <button type="button" className="ps-button ps-button-neutral" onClick={() => { keys.reload(); catalog.reload(); }}>
                        Повторить
                    </button>
                </div>
            </section>
        );
    return (
        <section className="cli-access-settings" aria-labelledby="cli-access-heading">
            <p className="ps-block-title">Personal Access Token</p>
            <h2 id="cli-access-heading" className="ps-subtitle">
                Персональные токены доступа
            </h2>
            <p className="ps-hint">Токен действует от вашего имени в пределах выбранных scopes и ваших актуальных прав.</p>
            <div className="ps-cli-heading-row">
                <p className="ps-hint">{keys.data
                    ? `Всего: ${visibleKeys.length} · Активных: ${activeKeys.length} · Истёкших: ${visibleKeys.length - activeKeys.length}`
                    : 'Загружаем ключи…'}</p>
                <button type="button" className="ps-button ps-button-primary" disabled={!catalog.data} onClick={() => setCreateOpen(true)}>
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
                                    options={PERSONAL_ACCESS_TOKEN_EXPIRY_OPTIONS}
                                />
                            </label>
                            <fieldset className="ps-scope-picker">
                                <legend>Scopes</legend>
                                <p>Выберите минимально необходимые разрешения.</p>
                                <div className="ps-scope-actions">
                                    <button type="button" className="ps-button ps-button-neutral"
                                        disabled={availableScopes.every(({ id }) => scopes.includes(id))}
                                        onClick={() => setScopes(availableScopes.map(({ id }) => id))}>
                                        Выбрать все
                                    </button>
                                    <button type="button" className="ps-button ps-button-neutral"
                                        disabled={scopes.length === 0} onClick={() => setScopes([])}>
                                        Снять выделение
                                    </button>
                                </div>
                                <div className="ps-scope-options">
                                    {[...scopeGroups].map(([groupId, group]) => {
                                        const ids = group.scopes.map(({ id }) => id);
                                        const selected = ids.filter((id) => scopes.includes(id)).length;
                                        return <div className="ps-scope-group" key={groupId}>
                                            <label className="ps-scope-group-toggle">
                                                <input type="checkbox" checked={selected === ids.length}
                                                    ref={(input) => { if (input) input.indeterminate = selected > 0 && selected < ids.length; }}
                                                    onChange={(event) => selectScopes(ids, event.target.checked)} />
                                                <strong>{group.title}</strong>
                                                <span>{selected}/{ids.length}</span>
                                            </label>
                                            {group.scopes.map(({ id: scope, title, description }) => (
                                                <label className="ps-scope-option" key={scope}>
                                                    <input type="checkbox" checked={scopes.includes(scope)}
                                                        onChange={(event) => selectScopes([scope], event.target.checked)} />
                                                    <span>
                                                        <strong>{title}</strong>
                                                        <small>{description}</small>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>;
                                    })}
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
            {visibleKeys.length > 0 && (
                <div className="ps-cli-list" role="region" aria-label="Персональные токены" tabIndex={0}>
                    <div className="ps-cli-head" aria-hidden="true">
                        <span>Название</span>
                        <span>Статус</span>
                        <span>Разрешения</span>
                        <span>Срок действия</span>
                        <span>Действия</span>
                    </div>
                    {visibleKeys.map((key) => (
                        <div className="ps-cli-row" key={key.id}>
                            <strong>{key.name}</strong>
                            <span>{new Date(key.expiresAt).getTime() > now ? 'Активен' : 'Истёк'}</span>
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
                                        await userSettingsApi.revoke(key.id);
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
