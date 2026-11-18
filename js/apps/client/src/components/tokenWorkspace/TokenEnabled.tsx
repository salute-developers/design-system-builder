import { useState } from 'react';
import { EyeClosedOutline } from '@salutejs/sdds-icons/16';

import { ConfirmDeleteDialog } from './TokenWorkspace';

export const DISABLED_TOKEN_TEXT = 'Токен отключён: его нет в пакете и в экспорте в Figma';

/** Отметка отключённого токена в строке дерева. */
export const DisabledFlag = () => <b className="tw-disabled-flag">Отключён</b>;

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

/** Кнопка «Отключить токен» в шапке инспектора: только у включённого токена и с правом правки. */
export const TokenEnabledButton = ({ toggle }: { toggle: TokenEnabledToggle }) =>
    toggle.enabled && toggle.editable ? (
        <button
            type="button"
            className="tw-icon-button"
            title="Отключить токен"
            aria-label="Отключить токен"
            disabled={toggle.busy}
            onClick={() => toggle.request(false)}
        >
            <EyeClosedOutline />
        </button>
    ) : null;

/** Сообщение об отключённом токене, ошибка изменения признака и подтверждение отключения используемого токена. */
export const TokenEnabledNotice = ({ toggle, name }: { toggle: TokenEnabledToggle; name: string }) => (
    <>
        {!toggle.enabled && (
            <div className="tw-notice" role="status">
                <span>{DISABLED_TOKEN_TEXT}</span>
                {toggle.editable && (
                    <button type="button" disabled={toggle.busy} onClick={() => toggle.request(true)}>
                        Включить
                    </button>
                )}
            </div>
        )}
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
