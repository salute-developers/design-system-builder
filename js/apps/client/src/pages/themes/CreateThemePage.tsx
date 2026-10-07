import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { designSystemsApi, projectsApi } from '../../api';
import { BuilderShell } from '../../components/BuilderShell/BuilderShell';
import { State } from '../../components/Catalog/Catalog';
import { any, choose, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { createTheme } from '../../modules/themes/application/createTheme';
import type { PreviewPalette, ThemePreviewMode, ThemeProfile } from '../../modules/themes/domain/theme';
import {
    customThemePresets,
    themeProfileLabels,
    themeProfilePreviews,
    themeProfileSwatches,
    validateCustomThemePalette,
} from '../../modules/themes/domain/themeProfiles';
import { isAccessDenied, useLoad } from '../../shared/data/useLoad';
import { getCreateThemeError } from './createThemeError';

export const CreateThemePage = () => {
    const { projectId = '', designSystemId = '' } = useParams();
    const navigate = useNavigate();
    const project = useLoad(() => projectsApi.get(projectId), [projectId], `project:${projectId}`);
    const system = useLoad(
        () => designSystemsApi.get(projectId, designSystemId),
        [projectId, designSystemId],
        `system:${projectId}:${designSystemId}`,
    );
    const [profile, setProfile] = useState<ThemeProfile>('malachite');
    const [palette, setPalette] = useState(customThemePresets.Neutral);
    const [mode, setMode] = useState<ThemePreviewMode>('light');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState('');
    const customPaletteError = profile === 'custom' ? validateCustomThemePalette(palette) : '';
    if ([project.error, system.error].some(isAccessDenied))
        return (
            <State
                text="Нет доступа"
                title="Создать Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectId={projectId}
                kind="theme"
            />
        );
    if (project.error || system.error)
        return (
            <State
                text="Не удалось загрузить проект"
                title="Создать Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectId={projectId}
                kind="theme"
                retry={() => {
                    project.reload();
                    system.reload();
                }}
            />
        );
    if (!project.data || !system.data)
        return (
            <State
                text="Загружаем проект…"
                title="Создать Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectId={projectId}
                kind="theme"
            />
        );
    if (
        any(
            system.data.isTechnical,
            project.data.status !== 'active',
            !can(project.data.effectiveRole, 'tenants:write'),
        )
    )
        return (
            <State
                text="Нет доступа"
                title="Создать Theme"
                back={`/projects/${projectId}/design-systems/${designSystemId}`}
                projectName={project.data.name}
                projectId={projectId}
                kind="theme"
            />
        );
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (customPaletteError) return;
        const rawName = String(new FormData(event.currentTarget).get('name'));
        setBusy(true);
        try {
            const theme = await createTheme(designSystemsApi, {
                projectId,
                designSystemId,
                rawName,
                profile,
                palette,
            });
            navigate(`/projects/${projectId}/design-systems/${designSystemId}/themes/${theme.id}/overview`);
        } catch (caught) {
            setError(getCreateThemeError(caught));
            setBusy(false);
        }
    };
    const customPreview = choose(
        mode === 'light',
        ['#171717', '#F5F5F5', palette[0], palette[1]],
        [palette[2], palette[3], palette[0], palette[1]],
    );
    const preview = { ...themeProfilePreviews, custom: { light: customPreview, dark: customPreview } }[profile][mode];
    return (
        <BuilderShell
            title="Создать Theme"
            back={`/projects/${projectId}/design-systems/${designSystemId}`}
            projectName={project.data.name}
            projectId={projectId}
            breadcrumbSegments={[
                { label: project.data.name, to: `/projects/${projectId}` },
                { label: system.data.name, to: `/projects/${projectId}/design-systems/${designSystemId}` },
            ]}
        >
            <form className="create-theme-workspace" onSubmit={submit} noValidate>
                <section className="create-theme-panel">
                    <header>Создать Theme</header>
                    <div className="create-theme-body">
                        <h2>Настройки Theme</h2>
                        <label className="create-theme-name">
                            Название
                            <input
                                name="name"
                                value={name}
                                onChange={(event) => {
                                    setName(event.target.value);
                                    setError('');
                                }}
                                required
                                maxLength={80}
                                placeholder="Например, Light Theme"
                            />
                        </label>
                        <Visible when={Boolean(error)}>
                            <p className="form-error" role="alert">
                                {error}
                            </p>
                        </Visible>
                        <h2>Стартовая палитра</h2>
                        <div className="theme-options">
                            {(['sber', 'malachite', 'b2b', 'custom'] as ThemeProfile[]).map((item) => (
                                <button
                                    className={`theme-option ${choose(profile === item, '', 'selected')}`}
                                    type="button"
                                    onClick={() => setProfile(item)}
                                    key={item}
                                >
                                    <span
                                        className="theme-option-swatch"
                                        style={
                                            {
                                                '--swatch': choose(
                                                    item === 'custom',
                                                    themeProfileSwatches[item as Exclude<ThemeProfile, 'custom'>],
                                                    palette[0],
                                                ),
                                            } as CSSProperties
                                        }
                                    />
                                    <span>{themeProfileLabels[item]}</span>
                                </button>
                            ))}
                        </div>
                        <Visible when={profile === 'custom'}>
                            <>
                                <h2>Custom palette</h2>
                                <div className="custom-presets">
                                    {Object.entries(customThemePresets).map(([name, value]) => (
                                        <button
                                            type="button"
                                            key={name}
                                            onClick={() => {
                                                setPalette(value);
                                                setError('');
                                            }}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                                <div className="custom-fields">
                                    {['Primary', 'On primary', 'Background', 'Text'].map((label, index) => (
                                        <label key={label}>
                                            {label}
                                            <input
                                                required
                                                value={palette[index]}
                                                aria-invalid={Boolean(customPaletteError)}
                                                aria-describedby={customPaletteError ? 'custom-palette-error' : undefined}
                                                onChange={(e) => {
                                                    setPalette(
                                                        palette.map((value, i) =>
                                                            choose(i === index, value, e.target.value),
                                                        ) as PreviewPalette,
                                                    );
                                                    setError('');
                                                }}
                                            />
                                        </label>
                                    ))}
                                </div>
                                <Visible when={Boolean(customPaletteError)}>
                                    <p className="form-error custom-palette-error" id="custom-palette-error" role="alert">
                                        {customPaletteError}
                                    </p>
                                </Visible>
                                <p className="catalog-meta">Проверьте соответствие цветов требованиям вашего бренда.</p>
                            </>
                        </Visible>
                    </div>
                    <footer className="create-theme-footer">
                        <Link className="builder-button" to={`/projects/${projectId}/design-systems/${designSystemId}`}>
                            Отмена
                        </Link>
                        <button
                            className="builder-button primary"
                            disabled={busy || !name.trim() || Boolean(customPaletteError)}
                        >
                            {choose(busy, 'Создать и открыть Theme', 'Создаём…')}
                        </button>
                    </footer>
                </section>
                <aside
                    className={`theme-live-preview create-theme-preview is-${mode}`}
                    style={
                        {
                            '--preview-bg': preview[0],
                            '--preview-text': preview[1],
                            '--preview-accent': preview[2],
                            '--theme-accent': preview[2],
                            '--theme-data': preview[3],
                            '--theme-text': preview[1],
                            '--theme-surface-card': preview[0],
                            '--theme-radius': '10px',
                        } as CSSProperties
                    }
                >
                    <div className="create-theme-preview-main">
                        <header>
                            <div>
                                <strong>{name.trim() || themeProfileLabels[profile]}</strong>
                                <span>
                                    {themeProfileLabels[profile]} · {mode === 'light' ? 'Light' : 'Dark'} · Inter · 10
                                </span>
                            </div>
                            <div className="create-theme-mode" role="group" aria-label="Режим превью">
                                <button
                                    type="button"
                                    className={choose(mode === 'light', '', 'is-active')}
                                    onClick={() => setMode('light')}
                                >
                                    Light
                                </button>
                                <button
                                    type="button"
                                    className={choose(mode === 'dark', '', 'is-active')}
                                    onClick={() => setMode('dark')}
                                >
                                    Dark
                                </button>
                            </div>
                        </header>
                        <div className="create-theme-preview-grid">
                            <div className="create-theme-preview-column">
                                <article className="preview-card-dynamics">
                                    <h3>Динамика операций</h3>
                                    <small>Активность за 6 месяцев</small>
                                    <div className="preview-bars">
                                        {[42, 68, 54, 82, 46, 90].map((height) => (
                                            <i key={height} style={{ height: `${height}%` }} />
                                        ))}
                                    </div>
                                    <div className="preview-stats">
                                        <span>
                                            Ближайший платёж
                                            <br />
                                            <strong>25 авг</strong>
                                        </span>
                                        <span>
                                            Автоплатёж
                                            <br />
                                            <strong>Включён</strong>
                                        </span>
                                    </div>
                                </article>
                                <article className="preview-card-limit">
                                    <h3>Лимит выплат</h3>
                                    <small>Настройка регулярного платежа</small>
                                    <strong className="preview-money">250 000 ₽</strong>
                                    <div className="preview-slider">
                                        <i />
                                    </div>
                                    <div className="preview-scale">
                                        <span>50 000 ₽</span>
                                        <span>1 000 000 ₽</span>
                                    </div>
                                </article>
                                <article className="preview-card-goals">
                                    <h3>Цели компании</h3>
                                    <small>Активные планы на 2026 год</small>
                                    <strong>4 200 000 ₽</strong>
                                    <div className="preview-progress">
                                        <i style={{ width: '68%' }} />
                                    </div>
                                    <strong>1 200 000 ₽</strong>
                                    <div className="preview-progress">
                                        <i style={{ width: '32%' }} />
                                    </div>
                                </article>
                            </div>
                            <div className="create-theme-preview-column">
                                <article className="preview-card-investment">
                                    <h3>Новая инвестиция</h3>
                                    <small>Параметры заявки</small>
                                    <label>
                                        Сумма<div className="preview-input">1 000 000 ₽</div>
                                    </label>
                                    <label>
                                        Тип заявки<div className="preview-input">Рыночная заявка</div>
                                    </label>
                                </article>
                                <article className="preview-empty">
                                    <span>+</span>
                                    <h3>Распределение дохода</h3>
                                    <small>Добавьте первый трек</small>
                                    <button type="button">Создать трек</button>
                                </article>
                                <article className="preview-card-balance">
                                    <h3>Баланс к выводу</h3>
                                    <strong className="preview-money">0,00 ₽</strong>
                                    <div className="preview-list">
                                        <span>
                                            Чистый доход <b>0,00 ₽</b>
                                        </span>
                                        <span>
                                            Комиссия <b>0,00 ₽</b>
                                        </span>
                                        <span>
                                            Доступно <b>0,00 ₽</b>
                                        </span>
                                    </div>
                                </article>
                                <article className="preview-card-operations">
                                    <h3>Последние операции</h3>
                                    <small>Движение денег по счетам</small>
                                    <div className="preview-operations">
                                        <span>
                                            <i />
                                            <b>Blue Bottle Coffee</b>
                                            <em>−650 ₽</em>
                                        </span>
                                        <span>
                                            <i />
                                            <b>Whole Foods Market</b>
                                            <em>−12 420 ₽</em>
                                        </span>
                                        <span>
                                            <i />
                                            <b>Поступление от клиента</b>
                                            <em className="is-positive">+420 000 ₽</em>
                                        </span>
                                    </div>
                                </article>
                            </div>
                            <div className="create-theme-preview-column">
                                <article className="preview-card-navigation">
                                    <small>РАБОЧЕЕ ПРОСТРАНСТВО</small>
                                    <nav className="preview-nav">
                                        <b>Обзор</b>
                                        <span>Операции</span>
                                        <span>Аналитика</span>
                                        <span>Счета</span>
                                    </nav>
                                </article>
                                <article className="preview-card-settings">
                                    <h3>Настройки пространства</h3>
                                    <small>Основные параметры команды</small>
                                    <label>
                                        Название<div className="preview-input">{name.trim() || 'Sber Business'}</div>
                                    </label>
                                    <div className="preview-switch-row">
                                        <span>Публичная статистика</span>
                                        <i />
                                    </div>
                                </article>
                                <article className="preview-card-turnover">
                                    <h3>Оборот по счетам</h3>
                                    <small>Последние 30 дней</small>
                                    <strong className="preview-money">8 420 000 ₽</strong>
                                    <div className="preview-line-chart">
                                        <svg viewBox="0 0 240 76" preserveAspectRatio="none" aria-hidden="true">
                                            <path d="M0 64 L28 56 L56 60 L84 40 L112 48 L140 25 L168 34 L196 10 L240 20 L240 76 L0 76 Z" />
                                            <polyline points="0,64 28,56 56,60 84,40 112,48 140,25 168,34 196,10 240,20" />
                                            <circle cx="240" cy="20" r="3" />
                                        </svg>
                                    </div>
                                </article>
                                <article className="preview-card-approval">
                                    <h3>Согласование платежа</h3>
                                    <small>Платёж № 2841 · сегодня до 18:00</small>
                                    <strong className="preview-money">840 000 ₽</strong>
                                    <div className="preview-list">
                                        <span>
                                            Инициатор <b>Анна Иванова</b>
                                        </span>
                                        <span>
                                            Назначение <b>Оборудование</b>
                                        </span>
                                    </div>
                                </article>
                            </div>
                        </div>
                    </div>
                    <footer className="create-theme-preview-note">
                        {profile === 'custom'
                            ? 'Параметры применяются сразу; после создания их можно точно настроить в Builder.'
                            : 'Готовый пресет: параметры можно уточнить после создания в Builder.'}
                    </footer>
                </aside>
            </form>
        </BuilderShell>
    );
};
