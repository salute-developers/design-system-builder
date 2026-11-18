import { useState } from 'react';
import { EyeClosedOutline, EyeOutline } from '@salutejs/sdds-icons/16';

import { ConfirmDeleteDialog, usePersistedOpen } from './TokenWorkspace';

export const DISABLED_TOKEN_TEXT = 'Токен отключён: его нет в пакете и в экспорте в Figma';

/** Отметка отключённого токена в строке дерева: перечёркнутый глаз, как у переключателя в инспекторе. */
export const DisabledFlag = () => (
    <span className="tw-disabled-flag" role="img" aria-label="Отключён" title={DISABLED_TOKEN_TEXT}>
        <EyeClosedOutline />
    </span>
);

/** Фильтр дерева «Скрыть отключённые токены»: один на три экрана токенов и запоминается в браузере. */
export const useHideDisabled = () => usePersistedOpen('dsb.tokens.hide-disabled');

/** Кнопка фильтра «Скрыть отключённые токены» в шапке дерева. */
export const HideDisabledButton = ({ pressed, onToggle }: { pressed: boolean; onToggle: () => void }) => (
    <button
        type="button"
        className="tw-icon-button"
        aria-label="Скрыть отключённые токены"
        aria-pressed={pressed}
        title="Скрыть отключённые токены"
        onClick={onToggle}
    >
        <EyeClosedOutline />
    </button>
);

export interface TokenEnabledToggle {
    enabled: boolean;
    editable: boolean;
    /** Компоненты, где используется токен; `null` — список неизвестен. */
    components: readonly string[] | null;
    busy: boolean;
    failed: boolean;
    confirming: boolean;
    /** Включает или отключает токен; отключение используемого токена сначала спрашивает подтверждение. */
    request: (enabled: boolean) => void;
    confirm: () => void;
    cancel: () => void;
    retry: () => void;
}

/**
 * Состояние включения токена в инспекторе. [save] меняет признак у всех определений токена и в модели темы. Ошибка и
 * подтверждение относятся к токену [subject]: при выборе другого токена они не переносятся.
 */
export const useTokenEnabled = (options: {
    subject: string;
    enabled: boolean;
    editable: boolean;
    components: readonly string[] | null;
    save: (enabled: boolean) => Promise<void>;
}): TokenEnabledToggle => {
    const [busy, setBusy] = useState(false);
    const [failedFor, setFailedFor] = useState<string | null>(null);
    const [confirmingFor, setConfirmingFor] = useState<string | null>(null);
    const [target, setTarget] = useState(false);

    const apply = async (enabled: boolean) => {
        const subject = options.subject;
        setConfirmingFor(null);
        setTarget(enabled);
        setBusy(true);
        setFailedFor(null);
        try {
            await options.save(enabled);
        } catch {
            setFailedFor(subject);
        } finally {
            setBusy(false);
        }
    };

    return {
        enabled: options.enabled,
        editable: options.editable,
        components: options.components,
        busy,
        failed: failedFor === options.subject,
        confirming: confirmingFor === options.subject,
        request: (enabled) =>
            enabled || options.components?.length === 0 ? void apply(enabled) : setConfirmingFor(options.subject),
        confirm: () => void apply(false),
        cancel: () => setConfirmingFor(null),
        retry: () => void apply(target),
    };
};

/**
 * Переключатель-глаз в шапке инспектора для обоих состояний: открытый глаз — токен включён, перечёркнутый — отключён.
 * Без права правки остаётся только отметка отключённого токена.
 */
export const TokenEnabledButton = ({ toggle }: { toggle: TokenEnabledToggle }) => {
    if (!toggle.editable) return toggle.enabled ? null : <DisabledFlag />;
    const state = toggle.enabled
        ? { label: 'Отключить токен', title: 'Отключить токен', icon: <EyeOutline /> }
        : { label: 'Включить токен', title: `${DISABLED_TOKEN_TEXT}. Включить токен`, icon: <EyeClosedOutline /> };
    return (
        <button
            type="button"
            className="tw-icon-button"
            title={state.title}
            aria-label={state.label}
            aria-pressed={!toggle.enabled}
            disabled={toggle.busy}
            onClick={() => toggle.request(!toggle.enabled)}
        >
            {state.icon}
        </button>
    );
};

/** Ошибка изменения признака и подтверждение отключения используемого токена. */
export const TokenEnabledNotice = ({ toggle, name }: { toggle: TokenEnabledToggle; name: string }) => (
    <>
        {toggle.failed && (
            <div className="tw-notice is-error" role="alert">
                <span>Не удалось изменить признак токена.</span>
                <button type="button" disabled={toggle.busy} onClick={toggle.retry}>
                    Повторить
                </button>
            </div>
        )}
        {toggle.confirming && (
            <ConfirmDeleteDialog
                titleId="token-disable-title"
                title="Отключить токен?"
                meta={name}
                confirmLabel="Отключить"
                cancelLabel="Не отключать"
                busy={toggle.busy}
                error={null}
                onCancel={toggle.cancel}
                onConfirm={toggle.confirm}
            >
                <p>
                    {toggle.components
                        ? `Токен используется в компонентах: ${toggle.components.join(', ')}.`
                        : 'Токен может использоваться в компонентах дизайн-системы.'}
                </p>
                <p>После публикации его не будет в пакете ни в одной теме дизайн-системы.</p>
            </ConfirmDeleteDialog>
        )}
    </>
);
