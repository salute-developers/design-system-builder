import { useState } from 'react';

import {
    differingPlatforms,
    parsePx,
    PLATFORM_LABELS,
    RANGES,
    SECTION_LABELS,
    shortName,
    validatePx,
    type DimensionToken,
    type NativePlatform,
    type SaveStatus,
    type ShadowLayer,
    type ShadowToken,
    type SizeToken,
    type SizeTokenOperationError,
    type SizeTokenValue,
} from '../../../modules/sizeTokens';
import type { ThemePalette } from '../../../modules/palette';
import { derivedLabel, derivedValue } from './SizeTokenBoard';
import { CommitInput, PlatformAdd } from './fields';
import { ShadowLayers } from './ShadowLayers';
import { StGlyph } from './StGlyph';

const DESCRIPTION = {
    radius: 'Радиус скругления углов компонентов и поверхностей.',
    spacing: 'Отступ из шкалы темы: Nx = N × 2 px.',
    shadow: 'Тень поверхности: направление, жёсткость и размер.',
} as const;

const PLATFORM_ORDER: readonly NativePlatform[] = ['ios', 'android'];

interface InspectorProps {
    /** Токен с несохранёнными правками. */
    token: SizeToken;
    /** Последнее сохранённое значение токена. */
    saved: SizeToken;
    editable: boolean;
    /** Открыта опубликованная версия: только чтение. */
    published: boolean;
    canDelete: boolean;
    save: SaveStatus;
    /** Ошибка операции другого токена, создания или удаления; такие операции повторяются автоматически. */
    otherError: SizeTokenOperationError | null;
    /** Палитра темы: ступени для цвета слоя тени. */
    palette: ThemePalette | null;
    onChange: (change: (value: SizeTokenValue) => SizeTokenValue) => void;
    onDelete: () => void;
    onRetry: () => void;
    onOpenComponent: (name: string) => void;
}

const platformsOf = <T,>(platforms: Partial<Record<NativePlatform, T>>) =>
    PLATFORM_ORDER.filter((platform) => platforms[platform] !== undefined);

/** Статус сохранения под заголовком инспектора: у экрана в прототипе нет панели инструментов. */
const SaveLine = ({ save, otherError, onRetry }: Pick<InspectorProps, 'save' | 'otherError' | 'onRetry'>) => {
    const failed = save.state === 'error' || otherError !== null;
    // «Повторить» отправляет сразу операцию, которая иначе повторится автоматически; отказ проверки не повторяется.
    const retryable = save.state === 'error' ? Boolean(save.error?.retryable) : otherError !== null;
    const label =
        save.state === 'error'
            ? 'Не сохранено'
            : save.state === 'saved'
              ? otherError
                  ? 'Не все правки сохранены'
                  : 'Сохранено'
              : 'Сохранение…';
    return (
        <div className="st-save-row">
            <span
                className={`st-save ${save.state === 'pending' || save.state === 'saving' ? 'is-saving' : ''} ${failed ? 'is-error' : ''}`}
                role="status"
                data-testid="size-tokens-save-status"
            >
                {label}
                {failed && retryable && (
                    <button type="button" className="st-inline-action" onClick={onRetry}>
                        Повторить
                    </button>
                )}
            </span>
        </div>
    );
};

/** Секция «Влияние»: компоненты дизайн-системы, которые используют токен. */
const Impact = ({ token, onOpenComponent }: { token: SizeToken; onOpenComponent: (name: string) => void }) => {
    const list = [...token.components].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const total = list.reduce((sum, item) => sum + item.count, 0);
    return (
        <>
            <section className="inspector-section typography-impact" data-testid="size-token-impact">
                <span className="inspector-heading">ВЛИЯНИЕ</span>
                <div className="impact-line">
                    Компоненты <b>{list.length}</b>
                </div>
                {!list.length && <p className="st-impact-empty">Токен не используется в компонентах дизайн-системы.</p>}
            </section>
            {list.length > 0 && (
                <section className="inspector-section component-impact typography-impact">
                    <span className="inspector-heading">СПИСОК КОМПОНЕНТОВ · {total} ЭКЗЕМПЛЯРОВ</span>
                    {list.map((item) => (
                        <button
                            key={item.name}
                            type="button"
                            className="impact-component"
                            onClick={() => onOpenComponent(item.name)}
                        >
                            <StGlyph name="jump" /> {item.name} <b>{item.count}</b>
                        </button>
                    ))}
                </section>
            )}
        </>
    );
};

/** Ошибка сервера `INVALID_SIZE_VALUE` у поля с путём [field] или вложенным в него. */
const serverErrorOf = (save: SaveStatus) => (field: string) => {
    const error = save.state === 'error' ? save.error : null;
    if (!error || error.kind !== 'invalid' || !error.field) return null;
    return error.field === field || error.field.startsWith(`${field}.`) || error.field.startsWith(`${field}[`)
        ? error.message
        : null;
};

/** Поля, к которым привязываются ошибки сервера; ошибка другого поля показывается баннером. */
const knownField = (token: SizeToken, field: string | null) =>
    field !== null &&
    (token.kind === 'shadow'
        ? /^(layers\[\d+\]|platforms\.(ios|android)\.layers\[\d+\]|fallbackElevation)/.test(field)
        : /^(valuePx|platforms\.(ios|android))$/.test(field));

/** Предупреждение о значениях платформ, которые отличаются от веба без своего значения. */
const PlatformsWarning = ({
    token,
    saved,
    editable,
    onKeep,
}: {
    token: SizeToken;
    saved: SizeToken;
    editable: boolean;
    onKeep: () => void;
}) => {
    const differ = saved.platformsDiffer ? differingPlatforms(token) : [];
    if (!differ.length) return null;
    const labels = differ.map((platform) => PLATFORM_LABELS[platform]).join(' и ');
    const text =
        token.kind === 'shadow'
            ? `Сейчас слои ${differ.map((platform) => PLATFORM_LABELS[platform]).join(', ')} отличаются от веба.`
            : `Сейчас ${differ.map((platform) => `${PLATFORM_LABELS[platform]} ${token.native[platform]} px`).join(', ')}, на вебе ${token.valuePx} px.`;
    return (
        <div className="st-warning" role="note" data-testid="platforms-differ">
            {text} Значения платформ строятся из веба: правка выровняет их.
            {editable && (
                <>
                    <br />
                    <button type="button" onClick={onKeep}>
                        Оставить как свои значения {labels}
                    </button>
                </>
            )}
        </div>
    );
};

const DimensionBody = ({
    token,
    saved,
    editable,
    save,
    onChange,
}: {
    token: DimensionToken;
    saved: DimensionToken;
    editable: boolean;
    save: SaveStatus;
    onChange: InspectorProps['onChange'];
}) => {
    const [errors, setErrors] = useState<Record<string, string | null>>({});
    const setError = (key: string, message: string | null) => setErrors((current) => ({ ...current, [key]: message }));
    const serverError = serverErrorOf(save);
    const range = RANGES[token.kind];
    const validate = (raw: string) => validatePx(raw, range);
    const overridden = platformsOf(token.platforms);
    const setDimension = (change: (value: Extract<SizeTokenValue, { kind: 'dimension' }>) => SizeTokenValue) =>
        onChange((value) => (value.kind === 'dimension' ? change(value) : value));
    const valueError = errors.valuePx ?? serverError('valuePx');
    return (
        <>
            <section className="inspector-section figma-inspector-group sizing-value-group">
                <span className="inspector-heading">{token.kind === 'radius' ? 'РАДИУС' : 'ОТСТУП'}</span>
                <div className={`figma-inspector-field ${valueError ? 'has-error' : ''}`}>
                    <span className="figma-inspector-field-label">Значение</span>
                    <div className="st-value-row">
                        <div className="figma-value-control">
                            <div className="figma-value-main">
                                {token.fullRounding ? (
                                    <input value="Full" aria-label="Значение, px" disabled readOnly />
                                ) : (
                                    <CommitInput
                                        aria-label="Значение, px"
                                        value={String(token.valuePx ?? '')}
                                        disabled={!editable}
                                        validate={validate}
                                        onIssue={(message) => setError('valuePx', message)}
                                        onCommit={(raw) =>
                                            setDimension((value) => ({ ...value, valuePx: parsePx(raw) }))
                                        }
                                    />
                                )}
                            </div>
                            <div className="figma-value-alpha">
                                <span>px</span>
                            </div>
                        </div>
                        {editable && !token.fullRounding && (
                            <PlatformAdd
                                added={overridden}
                                label="Своё значение платформы"
                                onAdd={(platform) =>
                                    setDimension((value) => ({
                                        ...value,
                                        platforms: { ...value.platforms, [platform]: value.valuePx },
                                    }))
                                }
                            />
                        )}
                    </div>
                </div>
                {valueError && <p className="st-field-error st-field-error-value">{valueError}</p>}
                {overridden.map((platform) => {
                    const message = errors[`platforms.${platform}`] ?? serverError(`platforms.${platform}`);
                    return (
                        <div key={platform}>
                            <div
                                className={`st-override ${message ? 'has-error' : ''}`}
                                data-testid={`override-${platform}`}
                            >
                                <span>↳ {PLATFORM_LABELS[platform]}</span>
                                <CommitInput
                                    aria-label={`Значение ${PLATFORM_LABELS[platform]}, px`}
                                    value={String(token.platforms[platform])}
                                    disabled={!editable}
                                    validate={validate}
                                    onIssue={(error) => setError(`platforms.${platform}`, error)}
                                    onCommit={(raw) =>
                                        setDimension((value) => ({
                                            ...value,
                                            platforms: { ...value.platforms, [platform]: parsePx(raw) },
                                        }))
                                    }
                                />
                                {editable ? (
                                    <button
                                        type="button"
                                        className="st-icon-btn"
                                        aria-label={`Убрать своё значение ${PLATFORM_LABELS[platform]}`}
                                        onClick={() => {
                                            setError(`platforms.${platform}`, null);
                                            setDimension((value) => {
                                                const platforms = { ...value.platforms };
                                                delete platforms[platform];
                                                return { ...value, platforms };
                                            });
                                        }}
                                    >
                                        ×
                                    </button>
                                ) : (
                                    <span />
                                )}
                            </div>
                            {message && <p className="st-field-error st-field-error-override">{message}</p>}
                        </div>
                    );
                })}
                {token.fullRounding && (
                    <p className="st-note">Полное скругление: форма пилюли при любой высоте. Значение не задаётся.</p>
                )}
            </section>
            <PlatformsWarning
                token={token}
                saved={saved}
                editable={editable}
                onKeep={() =>
                    setDimension((value) => {
                        const platforms = { ...value.platforms };
                        differingPlatforms(token).forEach((platform) => {
                            const native = token.native[platform];
                            if (native !== null) platforms[platform] = native;
                        });
                        return { ...value, platforms };
                    })
                }
            />
            {token.kind === 'radius' && token.derived.length > 0 && (
                <section className="inspector-section figma-inspector-group" data-testid="derived-section">
                    <span className="inspector-heading">ВЫЧИСЛЯЕМЫЕ</span>
                    {token.derived.map((item) => (
                        <div key={item.offsetPx} className="st-derived-line">
                            <b>{derivedLabel(token, item.offsetPx)}</b>
                            <b>{derivedValue(token, item.offsetPx)} px</b>
                            <small>
                                {item.usages
                                    .map((usage) =>
                                        [
                                            usage.component,
                                            usage.platform === 'web' ? 'Web' : usage.platform,
                                            usage.parameter,
                                        ]
                                            .filter(Boolean)
                                            .join(' · '),
                                    )
                                    .join('; ')}
                            </small>
                        </div>
                    ))}
                    <p className="st-note">Смещение задаётся в компоненте.</p>
                </section>
            )}
        </>
    );
};

const ShadowBody = ({
    token,
    saved,
    editable,
    save,
    onChange,
}: {
    token: ShadowToken;
    saved: ShadowToken;
    editable: boolean;
    save: SaveStatus;
    onChange: InspectorProps['onChange'];
}) => {
    const [elevationIssue, setElevationIssue] = useState<string | null>(null);
    const serverError = serverErrorOf(save);
    const overridden = platformsOf(token.platforms);
    const setShadow = (change: (value: Extract<SizeTokenValue, { kind: 'shadow' }>) => SizeTokenValue) =>
        onChange((value) => (value.kind === 'shadow' ? change(value) : value));
    const setPlatformLayers = (platform: NativePlatform, layers: ShadowLayer[] | null) =>
        setShadow((value) => {
            const platforms = { ...value.platforms };
            if (layers) platforms[platform] = layers;
            else delete platforms[platform];
            return { ...value, platforms };
        });
    const elevationMessage = elevationIssue ?? serverError('fallbackElevation');
    return (
        <>
            <section className="inspector-section figma-inspector-group">
                <div className="st-heading-row">
                    <span className="inspector-heading">СЛОИ</span>
                    {editable && (
                        <PlatformAdd
                            added={overridden}
                            label="Свои слои платформы"
                            onAdd={(platform) =>
                                setPlatformLayers(
                                    platform,
                                    token.layers.map((layer) => ({ ...layer })),
                                )
                            }
                        />
                    )}
                </div>
                <ShadowLayers
                    layers={token.layers}
                    editable={editable}
                    scope="Веб"
                    fieldPrefix="layers"
                    serverError={serverError}
                    onChange={(layers) => setShadow((value) => ({ ...value, layers }))}
                />
            </section>
            {overridden.map((platform) => (
                <section
                    key={platform}
                    className="inspector-section figma-inspector-group"
                    data-testid={`override-layers-${platform}`}
                >
                    <div className="st-heading-row">
                        <span className="inspector-heading">↳ {PLATFORM_LABELS[platform]} · СВОИ СЛОИ</span>
                        {editable && (
                            <button
                                type="button"
                                className="st-icon-btn"
                                aria-label={`Убрать свои слои ${PLATFORM_LABELS[platform]}`}
                                onClick={() => setPlatformLayers(platform, null)}
                            >
                                ×
                            </button>
                        )}
                    </div>
                    <ShadowLayers
                        layers={token.platforms[platform]!.layers}
                        editable={editable}
                        scope={PLATFORM_LABELS[platform]}
                        fieldPrefix={`platforms.${platform}.layers`}
                        serverError={serverError}
                        onChange={(layers) => setPlatformLayers(platform, layers)}
                    />
                </section>
            ))}
            <PlatformsWarning
                token={token}
                saved={saved}
                editable={editable}
                onKeep={() =>
                    setShadow((value) => {
                        const platforms = { ...value.platforms };
                        differingPlatforms(token).forEach((platform) => {
                            const native = token.native[platform];
                            if (native) platforms[platform] = native.layers;
                        });
                        return { ...value, platforms };
                    })
                }
            />
            <section className="inspector-section figma-inspector-group">
                <span className="inspector-heading">ANDROID</span>
                <label className={`st-field st-field-wide ${elevationMessage ? 'has-error' : ''}`}>
                    <span>Elevation</span>
                    <CommitInput
                        aria-label="Запасная высота Android"
                        value={String(token.fallbackElevation)}
                        disabled={!editable}
                        validate={(raw) => validatePx(raw, RANGES.elevation)}
                        onIssue={setElevationIssue}
                        onCommit={(raw) => setShadow((value) => ({ ...value, fallbackElevation: parsePx(raw) }))}
                    />
                </label>
                {elevationMessage && <p className="st-field-error">{elevationMessage}</p>}
                <p className="st-note">Запасная высота тени для Android.</p>
            </section>
        </>
    );
};

/** Инспектор токена по `tokenInspector` прототипа для `group === 'sizes'`. */
export const SizeTokenInspector = (props: InspectorProps) => {
    const { token, saved, editable, canDelete, save } = props;
    const unmatched = save.state === 'error' && save.error && !knownField(token, save.error.field) ? save.error : null;
    return (
        <>
            <header className="token-inspector-header">
                <div>
                    <strong role="heading" aria-level={1}>
                        {SECTION_LABELS[token.kind]} / {shortName(token)}
                    </strong>
                    <span className="token-inspector-actions">
                        {canDelete && (
                            <button
                                type="button"
                                title="Удалить токен"
                                aria-label="Удалить токен"
                                onClick={props.onDelete}
                            >
                                <StGlyph name="delete" />
                            </button>
                        )}
                    </span>
                </div>
                <p>
                    {token.name} · {DESCRIPTION[token.kind]}
                </p>
            </header>
            {!props.published && <SaveLine save={save} otherError={props.otherError} onRetry={props.onRetry} />}
            {!editable && (
                <div className="st-warning is-neutral" role="status" data-testid="size-tokens-viewer">
                    {props.published
                        ? 'Опубликованная версия: значения доступны только для чтения.'
                        : 'Режим просмотра: у вас нет прав на изменение темы.'}
                </div>
            )}
            {unmatched && (
                <div className="st-warning is-error" role="alert">
                    Не сохранено: {unmatched.message}
                </div>
            )}
            {token.kind === 'shadow' && saved.kind === 'shadow' ? (
                <ShadowBody token={token} saved={saved} editable={editable} save={save} onChange={props.onChange} />
            ) : token.kind !== 'shadow' && saved.kind !== 'shadow' ? (
                <DimensionBody token={token} saved={saved} editable={editable} save={save} onChange={props.onChange} />
            ) : null}
            <Impact token={token} onOpenComponent={props.onOpenComponent} />
        </>
    );
};
