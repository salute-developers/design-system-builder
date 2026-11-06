import { useState } from 'react';
import { CloseOutline, TrashOutline } from '@salutejs/sdds-icons/16';

import {
    FieldMessage,
    fieldClass,
    InspectorHeader,
    instancesLabel,
    SectionHeader,
} from '../../../components/tokenWorkspace';
import {
    differingPlatforms,
    parsePx,
    PLATFORM_LABELS,
    RANGES,
    validatePx,
    type DimensionToken,
    type NativePlatform,
    type SaveStatus,
    type ShadowLayer,
    type ShadowToken,
    type SizeToken,
    type LayerScope,
    type SizeTokenOperationError,
    type SizeTokenValue,
} from '../../../modules/sizeTokens';
import { derivedLabel, derivedValue } from './SizeTokenBoard';
import { CommitInput, PlatformAdd } from './fields';
import { ShadowLayers } from './ShadowLayers';

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
    /** Описание токена из определения; `onDescribe` — его правка в шапке, у Viewer её нет. */
    description: string;
    onDescribe?: (value: string) => Promise<void>;
    /** Переименование двойным щелчком по имени в шапке: правится полное имя, префикс раздела можно не вводить. */
    onRename?: (value: string) => Promise<void>;
    /** Сброс изменений токена в черновике (подключается снаружи); без него кнопки нет. */
    onReset?: () => void;
    resetDisabled?: boolean;
    save: SaveStatus;
    /** Ошибка операции другого токена, создания или удаления; такие операции повторяются автоматически. */
    otherError: SizeTokenOperationError | null;
    /** Название ступени палитры цвета слоя тени («Gray 900») или `null` у HEX. */
    colorLabel: (layer: ShadowLayer) => string | null;
    /** Открытый выбор цвета слоя тени. */
    picker: { scope: LayerScope; index: number } | null;
    onOpenPicker: (scope: LayerScope, index: number) => void;
    onChange: (change: (value: SizeTokenValue) => SizeTokenValue) => void;
    onDelete: () => void;
    onRetry: () => void;
    onOpenComponent: (name: string) => void;
}

const platformsOf = <T,>(platforms: Partial<Record<NativePlatform, T>>) =>
    PLATFORM_ORDER.filter((platform) => platforms[platform] !== undefined);

/** Статус сохранения под шапкой инспектора: у раздела нет шапки рабочей области (осознанное отступление). */
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
            <section className="st-section tw-section" data-testid="size-token-impact">
                <SectionHeader title="Влияние" />
                <div className="st-row tw-list-row">
                    <span>Компоненты</span>
                    <b>{list.length}</b>
                </div>
                {!list.length && <p className="st-note">Токен не используется в компонентах дизайн-системы.</p>}
            </section>
            {list.length > 0 && (
                <section className="st-section tw-section">
                    <SectionHeader title={`Список компонентов · ${instancesLabel(total)}`} />
                    {list.map((item) => (
                        <button
                            key={item.name}
                            type="button"
                            className="st-row st-row-link tw-list-row is-link"
                            title={`Открыть компонент ${item.name}`}
                            onClick={() => onOpenComponent(item.name)}
                        >
                            <span>{item.name}</span>
                            <b>{item.count}</b>
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
            <section className="st-section tw-section">
                <SectionHeader title={token.kind === 'radius' ? 'Радиус' : 'Отступ'} />
                <div className="st-field-block tw-field-block">
                    <label className="st-field-label tw-field-label" htmlFor={`size-value-${token.tokenId}`}>
                        Значение, px
                    </label>
                    <div className="st-field-row tw-field-line">
                        {token.fullRounding ? (
                            <input
                                id={`size-value-${token.tokenId}`}
                                className={`st-input ${fieldClass()}`}
                                value="Full"
                                aria-label="Значение, px"
                                disabled
                                readOnly
                            />
                        ) : (
                            <CommitInput
                                id={`size-value-${token.tokenId}`}
                                className={`st-input ${fieldClass(valueError ? 'error' : null)}`}
                                aria-label="Значение, px"
                                aria-invalid={Boolean(valueError)}
                                value={String(token.valuePx ?? '')}
                                disabled={!editable}
                                validate={validate}
                                onIssue={(message) => setError('valuePx', message)}
                                onCommit={(raw) => setDimension((value) => ({ ...value, valuePx: parsePx(raw) }))}
                            />
                        )}
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
                    {valueError && <FieldMessage>{valueError}</FieldMessage>}
                </div>
                {overridden.map((platform) => {
                    const message = errors[`platforms.${platform}`] ?? serverError(`platforms.${platform}`);
                    return (
                        <div key={platform} className="st-override-block">
                            <div className="st-override tw-field-inline" data-testid={`override-${platform}`}>
                                <span className="tw-field-label">↳ {PLATFORM_LABELS[platform]}</span>
                                <span className="tw-field-line">
                                    <CommitInput
                                        className={`st-input ${fieldClass(message ? 'error' : null)}`}
                                        aria-label={`Значение ${PLATFORM_LABELS[platform]}, px`}
                                        aria-invalid={Boolean(message)}
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
                                    {editable && (
                                        <button
                                            type="button"
                                            className="tw-icon-button"
                                            title={`Убрать своё значение ${PLATFORM_LABELS[platform]}`}
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
                                            <CloseOutline />
                                        </button>
                                    )}
                                </span>
                            </div>
                            {message && <FieldMessage>{message}</FieldMessage>}
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
                <section className="st-section tw-section" data-testid="derived-section">
                    <SectionHeader title="Вычисляемые" />
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
    colorLabel,
    picker,
    onOpenPicker,
}: {
    token: ShadowToken;
    saved: ShadowToken;
    editable: boolean;
    save: SaveStatus;
    onChange: InspectorProps['onChange'];
} & Pick<InspectorProps, 'colorLabel' | 'picker' | 'onOpenPicker'>) => {
    /** Свойства выбора цвета для слоёв набора [scope]. */
    const colorProps = (scope: LayerScope) => ({
        colorLabel,
        pickerOpen: (index: number) => picker?.scope === scope && picker.index === index,
        onOpenPicker: (index: number) => onOpenPicker(scope, index),
    });
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
            <section className="st-section tw-section">
                <SectionHeader
                    title="Слои"
                    actions={
                        editable && (
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
                        )
                    }
                />
                <ShadowLayers
                    layers={token.layers}
                    editable={editable}
                    scope="Веб"
                    fieldPrefix="layers"
                    serverError={serverError}
                    {...colorProps('web')}
                    onChange={(layers) => setShadow((value) => ({ ...value, layers }))}
                />
            </section>
            {overridden.map((platform) => (
                <section key={platform} className="st-section tw-section" data-testid={`override-layers-${platform}`}>
                    <SectionHeader
                        title={`↳ ${PLATFORM_LABELS[platform]} · свои слои`}
                        actions={
                            editable && (
                                <button
                                    type="button"
                                    className="tw-icon-button"
                                    title={`Убрать свои слои ${PLATFORM_LABELS[platform]}`}
                                    aria-label={`Убрать свои слои ${PLATFORM_LABELS[platform]}`}
                                    onClick={() => setPlatformLayers(platform, null)}
                                >
                                    <CloseOutline />
                                </button>
                            )
                        }
                    />
                    <ShadowLayers
                        layers={token.platforms[platform]!.layers}
                        editable={editable}
                        scope={PLATFORM_LABELS[platform]}
                        fieldPrefix={`platforms.${platform}.layers`}
                        serverError={serverError}
                        {...colorProps(platform)}
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
            <section className="st-section tw-section">
                <SectionHeader title="Android" />
                <label className="st-override tw-field-inline">
                    <span className="tw-field-label">Elevation</span>
                    <CommitInput
                        className={`st-input ${fieldClass(elevationMessage ? 'error' : null)}`}
                        aria-label="Запасная высота Android"
                        value={String(token.fallbackElevation)}
                        disabled={!editable}
                        validate={(raw) => validatePx(raw, RANGES.elevation)}
                        onIssue={setElevationIssue}
                        onCommit={(raw) => setShadow((value) => ({ ...value, fallbackElevation: parsePx(raw) }))}
                    />
                </label>
                {elevationMessage && <FieldMessage>{elevationMessage}</FieldMessage>}
                <p className="st-note">Запасная высота тени для Android.</p>
            </section>
        </>
    );
};

/** Инспектор радиуса, отступа или тени: шапка `Inspector/Header`, секции `Panel/SectionHeader`, поля `ValueField`. */
export const SizeTokenInspector = (props: InspectorProps) => {
    const { token, saved, editable, canDelete, save } = props;
    const unmatched = save.state === 'error' && save.error && !knownField(token, save.error.field) ? save.error : null;
    return (
        <>
            <InspectorHeader
                title={token.name}
                description={props.description}
                onDescribe={props.onDescribe}
                onRename={props.onRename}
                onReset={props.onReset}
                resetDisabled={props.resetDisabled}
                actions={
                    canDelete && (
                        <button
                            type="button"
                            className="tw-icon-button"
                            title="Удалить токен"
                            aria-label="Удалить токен"
                            onClick={props.onDelete}
                        >
                            <TrashOutline />
                        </button>
                    )
                }
            />
            <div className="st-inspector-body">
                {!editable && (
                    <div className="viewer-banner" role="status" data-testid="size-tokens-viewer">
                        <span>Только просмотр</span>
                    </div>
                )}
                {!props.published && <SaveLine save={save} otherError={props.otherError} onRetry={props.onRetry} />}
                {unmatched && (
                    <div className="st-warning is-error" role="alert">
                        Не сохранено: {unmatched.message}
                    </div>
                )}
                {token.kind === 'shadow' && saved.kind === 'shadow' ? (
                    <ShadowBody
                        token={token}
                        saved={saved}
                        editable={editable}
                        save={save}
                        onChange={props.onChange}
                        colorLabel={props.colorLabel}
                        picker={props.picker}
                        onOpenPicker={props.onOpenPicker}
                    />
                ) : token.kind !== 'shadow' && saved.kind !== 'shadow' ? (
                    <DimensionBody
                        token={token}
                        saved={saved}
                        editable={editable}
                        save={save}
                        onChange={props.onChange}
                    />
                ) : null}
                <Impact token={token} onOpenComponent={props.onOpenComponent} />
            </div>
        </>
    );
};
