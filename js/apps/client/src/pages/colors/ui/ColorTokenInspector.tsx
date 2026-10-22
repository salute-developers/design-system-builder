import { Fragment, useEffect, useRef, useState } from 'react';

import {
    COLOR_CONTEXTS,
    NATIVE_PLATFORMS,
    type ColorContext,
    type ColorFieldValue,
    type ColorTokenView,
    type NativePlatform,
    type PaintPlatform,
    type SaveStatus,
} from '../../../modules/colorTokens';
import type { FieldId } from '../colorTokenEditor';
import { ColorField } from './ColorField';
import { CtGlyph } from './CtGlyph';
import { PublishedWarning } from './ColorTokenTree';
import { InlineRename } from './InlineRename';

const CONTEXT_LABELS: Record<ColorContext, string> = { ondark: 'OnDark', onlight: 'OnLight', inverse: 'Inverse' };
export const PLATFORM_LABELS: Record<PaintPlatform, string> = { web: 'Web', ios: 'iOS', android: 'Android' };

const LINKED_TIP =
    'Контексты наследуют значения из Modes. Ручное изменение отключает связь. Нажмите на иконку связи, чтобы восстановить наследование и сбросить значения к дефолтным.';
const UNLINKED_TIP =
    'Связь отключена. Используются ручные значения. Нажмите на иконку связи, чтобы вернуть наследование из Modes и сбросить изменения.';

/** Открытый выбор цвета: поле и платформа строки (web — верхнее поле). */
export interface PickerTarget {
    field: FieldId;
    platform: PaintPlatform;
}

interface InspectorProps {
    view: ColorTokenView;
    editable: boolean;
    canDelete: boolean;
    openPicker: PickerTarget | null;
    /** Получает кнопку цвета поля с открытым выбором цвета. */
    pickerAnchor?: (node: HTMLElement | null) => void;
    save: SaveStatus;
    onOpenPicker: (target: PickerTarget) => void;
    onCommit: (target: PickerTarget, value: string) => void;
    onOpacity: (target: PickerTarget, percent: number) => void;
    /** «+» у значения: строка своего значения платформы. */
    onAddPlatform: (field: FieldId, platform: NativePlatform) => void;
    /** «×» у строки платформы: значение снова строится из web. */
    onRemovePlatform: (field: FieldId, platform: NativePlatform) => void;
    onRelink: (context: ColorContext) => void;
    onResetContexts: () => void;
    onDelete: () => void;
    onFill: () => void;
    onRetry: () => void;
    /** Переименование токена: отказ бросает ошибку с текстом для поля имени. */
    onRename: (label: string) => Promise<void>;
    /** Подпись адреса недопустимого значения `<токен>:<platform>:<mode>`: подтема, платформа и режим. */
    addressLabel: (address: string) => string;
}

/** Описание токена (`colorTokenDescription`): своё или общее. */
const description = (view: ColorTokenView) =>
    view.description ||
    'Значение токена используется в связанных состояниях темы и наследуется компонентами дизайн-системы.';

/**
 * Имя в заголовке инспектора: двойной щелчок делает его редактируемым на месте, как в навигаторе Xcode; Enter
 * или уход фокуса переименовывают токен, Escape отменяет правку.
 */
const HeaderName = ({ view, editable, onRename }: Pick<InspectorProps, 'view' | 'editable' | 'onRename'>) => {
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const running = useRef(false);
    useEffect(() => {
        setEditing(false);
        setError(null);
    }, [view.id]);
    const submit = async (label: string) => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        setError(null);
        try {
            await onRename(label);
            setEditing(false);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
            running.current = false;
            setBusy(false);
        }
    };
    return (
        <>
            <strong
                role="heading"
                aria-level={1}
                className={editing ? 'is-renaming' : ''}
                title={editable && !editing ? 'Дважды щёлкните, чтобы переименовать' : undefined}
                onDoubleClick={() => {
                    if (!editable || editing) return;
                    setError(null);
                    setEditing(true);
                }}
            >
                {editing ? (
                    <InlineRename
                        label={`Новое имя ${view.displayName}`}
                        initial={view.displayName}
                        busy={busy}
                        error={error}
                        onSubmit={(label) => void submit(label)}
                        onCancel={() => {
                            setEditing(false);
                            setError(null);
                        }}
                    />
                ) : (
                    view.displayName
                )}
                {editing && view.publishedIn && <PublishedWarning version={view.publishedIn} />}
            </strong>
            {editing && error && (
                <span className="token-tree-input-error ct-header-rename-error" role="alert">
                    {error}
                </span>
            )}
        </>
    );
};

/** «+» у значения: меню платформ, у которых ещё нет своей строки. */
const PlatformAdd = ({
    name,
    platforms,
    onAdd,
}: {
    name: string;
    platforms: NativePlatform[];
    onAdd: (platform: NativePlatform) => void;
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (event: Event) => {
            if (
                event instanceof globalThis.KeyboardEvent
                    ? event.key === 'Escape'
                    : !ref.current?.contains(event.target as Node)
            )
                setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [open]);
    return (
        <div className="ct-platform-add" ref={ref}>
            <button
                type="button"
                className="ct-platform-button"
                aria-label={`Своё значение платформы: ${name}`}
                title="Своё значение для платформы"
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={!platforms.length}
                onClick={() => setOpen((current) => !current)}
            >
                +
            </button>
            {open && (
                <div className="reset-dropdown ct-platform-menu" role="menu">
                    {platforms.map((platform) => (
                        <button
                            key={platform}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                onAdd(platform);
                            }}
                        >
                            {PLATFORM_LABELS[platform]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/** Инспектор токена по `tokenInspector` прототипа. */
export const ColorTokenInspector = (props: InspectorProps) => {
    const { view, editable, canDelete, openPicker, save } = props;

    /**
     * Поле значения Light или Dark и под ним строки своих значений платформ. «+» есть только у полей режимов.
     * Связанная подтема только показывает унаследованные строки, без «+» и «×»: их убирают у режима.
     * В отвязанной подтеме значения свои, поэтому строку можно убрать «×».
     */
    const field = (
        id: FieldId,
        label: string,
        value: ColorFieldValue,
        name: string,
        canAdd = true,
        canRemove = true,
    ) => {
        const own = NATIVE_PLATFORMS.filter((platform) => value.platforms[platform]);
        const free = NATIVE_PLATFORMS.filter((platform) => !value.platforms[platform]);
        const web = { field: id, platform: 'web' as const };
        return (
            <Fragment key={id}>
                <ColorField
                    label={label}
                    name={name}
                    value={value}
                    editable={editable}
                    pickerOpen={openPicker?.field === id && openPicker.platform === 'web'}
                    pickerAnchor={props.pickerAnchor}
                    onOpenPicker={() => props.onOpenPicker(web)}
                    onCommit={(next) => props.onCommit(web, next)}
                    onOpacity={(percent) => props.onOpacity(web, percent)}
                    trailing={
                        editable &&
                        canAdd && (
                            <PlatformAdd
                                name={name}
                                platforms={free}
                                onAdd={(platform) => props.onAddPlatform(id, platform)}
                            />
                        )
                    }
                />
                {own.map((platform) => {
                    const target = { field: id, platform };
                    return (
                        <ColorField
                            key={platform}
                            label={`↳ ${PLATFORM_LABELS[platform]}`}
                            name={`${name}, ${PLATFORM_LABELS[platform]}`}
                            platformRow
                            value={value.platforms[platform]!}
                            editable={editable}
                            pickerOpen={openPicker?.field === id && openPicker.platform === platform}
                            pickerAnchor={props.pickerAnchor}
                            onOpenPicker={() => props.onOpenPicker(target)}
                            onCommit={(next) => props.onCommit(target, next)}
                            onOpacity={(percent) => props.onOpacity(target, percent)}
                            trailing={
                                editable &&
                                canRemove && (
                                    <button
                                        type="button"
                                        className="ct-platform-button"
                                        aria-label={`Убрать своё значение ${PLATFORM_LABELS[platform]}: ${name}`}
                                        title={`Убрать своё значение ${PLATFORM_LABELS[platform]}: снова строится из Web`}
                                        onClick={() => props.onRemovePlatform(id, platform)}
                                    >
                                        ×
                                    </button>
                                )
                            }
                        />
                    );
                })}
            </Fragment>
        );
    };
    return (
        <>
            <header className="token-inspector-header">
                <div>
                    <HeaderName view={view} editable={editable} onRename={props.onRename} />
                    <span className="token-inspector-actions">
                        {canDelete && (
                            <button
                                type="button"
                                title="Удалить токен"
                                aria-label="Удалить токен"
                                onClick={props.onDelete}
                            >
                                <CtGlyph name="delete" />
                            </button>
                        )}
                    </span>
                </div>
                <p>{description(view)}</p>
            </header>
            {save.state === 'error' && save.error && (
                <div className="ct-banner" role="alert">
                    <span>
                        Не сохранено: {save.error.message}
                        {save.error.address ? ` (${props.addressLabel(save.error.address)})` : ''}
                    </span>
                    <button type="button" className="ct-inline-action" onClick={props.onRetry}>
                        Повторить
                    </button>
                </div>
            )}
            {view.incomplete && (
                <div className="ct-banner" role="status">
                    <span>Нет значений в этой теме</span>
                    {editable && (
                        <button type="button" className="ct-inline-action" onClick={props.onFill}>
                            Заполнить
                        </button>
                    )}
                </div>
            )}
            <section className="inspector-section figma-inspector-group">
                <span className="inspector-heading">ТЕМЫ ПО УМОЛЧАНИЮ</span>
                {field('light', 'Light', view.modes.light, 'Light')}
                {field('dark', 'Dark', view.modes.dark, 'Dark')}
            </section>
            <section className="inspector-section figma-inspector-group figma-subthemes">
                <div className="figma-subthemes-heading">
                    <span className="inspector-heading">ПОДТЕМЫ</span>
                    <button
                        type="button"
                        title="Сбросить подтемы"
                        aria-label="Сбросить подтемы"
                        disabled={!editable}
                        onClick={props.onResetContexts}
                    >
                        <CtGlyph name="reset" />
                    </button>
                </div>
                {COLOR_CONTEXTS.map((context) => {
                    const { linked, values } = view.contexts[context];
                    return (
                        <Fragment key={context}>
                            <div className="figma-subtheme-title">
                                <span>{CONTEXT_LABELS[context]}</span>
                                <b>
                                    <button
                                        type="button"
                                        className={`context-link-toggle ${linked ? 'is-linked' : 'is-unlinked'}`}
                                        title={linked ? LINKED_TIP : UNLINKED_TIP}
                                        aria-label={linked ? 'Связь с Modes включена' : 'Связь с Modes отключена'}
                                        aria-pressed={linked}
                                        disabled={!editable}
                                        onClick={() => !linked && props.onRelink(context)}
                                    >
                                        {linked ? '⛓' : '⛓̸'}
                                    </button>
                                </b>
                            </div>
                            {field(`${context}-light`, 'Light', values.light, 'Light', false, !linked)}
                            {field(`${context}-dark`, 'Dark', values.dark, 'Dark', false, !linked)}
                        </Fragment>
                    );
                })}
            </section>
        </>
    );
};
