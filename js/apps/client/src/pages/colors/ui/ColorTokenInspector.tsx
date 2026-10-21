import { Fragment } from 'react';

import { COLOR_CONTEXTS, type ColorContext, type ColorTokenView, type SaveStatus } from '../../../modules/colorTokens';
import type { FieldId } from '../colorTokenEditor';
import { ColorField } from './ColorField';
import { CtGlyph } from './CtGlyph';

const CONTEXT_LABELS: Record<ColorContext, string> = { ondark: 'OnDark', onlight: 'OnLight', inverse: 'Inverse' };

const LINKED_TIP =
    'Контексты наследуют значения из Modes. Ручное изменение отключает связь. Нажмите на иконку связи, чтобы восстановить наследование и сбросить значения к дефолтным.';
const UNLINKED_TIP =
    'Связь отключена. Используются ручные значения. Нажмите на иконку связи, чтобы вернуть наследование из Modes и сбросить изменения.';

interface InspectorProps {
    view: ColorTokenView;
    editable: boolean;
    canDelete: boolean;
    openField: FieldId | null;
    save: SaveStatus;
    onOpenPicker: (field: FieldId) => void;
    onCommit: (field: FieldId, value: string) => void;
    onOpacity: (field: FieldId, percent: number) => void;
    onRelink: (context: ColorContext) => void;
    onResetContexts: () => void;
    onDelete: () => void;
    onFill: () => void;
    onRetry: () => void;
    /** Подпись адреса недопустимого значения `<токен>:<platform>:<mode>`: подтема, платформа и режим. */
    addressLabel: (address: string) => string;
}

/** Описание токена (`colorTokenDescription`): своё или общее. */
const description = (view: ColorTokenView) =>
    view.description ||
    'Значение токена используется в связанных состояниях темы и наследуется компонентами дизайн-системы.';

/** Инспектор токена по `tokenInspector` прототипа. */
export const ColorTokenInspector = (props: InspectorProps) => {
    const { view, editable, canDelete, openField, save } = props;
    const field = (id: FieldId, label: string, value: ColorTokenView['modes']['light']) => (
        <ColorField
            key={id}
            label={label}
            value={value}
            type={view.key.type}
            editable={editable}
            pickerOpen={openField === id}
            onOpenPicker={() => props.onOpenPicker(id)}
            onCommit={(next) => props.onCommit(id, next)}
            onOpacity={(percent) => props.onOpacity(id, percent)}
        />
    );
    return (
        <>
            <header className="token-inspector-header">
                <div>
                    <strong role="heading" aria-level={1}>
                        {view.displayName}
                    </strong>
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
                {field('light', 'Light', view.modes.light)}
                {field('dark', 'Dark', view.modes.dark)}
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
                            {field(`${context}-light`, 'Light', values.light)}
                            {field(`${context}-dark`, 'Dark', values.dark)}
                        </Fragment>
                    );
                })}
            </section>
        </>
    );
};
