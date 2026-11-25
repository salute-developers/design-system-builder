import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { ArrowUpOutline, CopyOutline, DoneOutline, StopFill } from '@salutejs/sdds-icons/16';

import type { AiScreenContext } from '../../api/aiChat';

import { toolLabel } from './aiChatTexts';
import { useAiChat } from './useAiChat';

interface AiChatPanelProps {
    projectId: string;
    designSystemId: string;
    /** Текущий контекст экрана для запроса хода. */
    getContext?: () => AiScreenContext | undefined;
    /** Закрытая панель скрыта, но разговор и чтение хода продолжаются. */
    open: boolean;
    onClose: () => void;
}

const accent = 'var(--p-accent, #2b8ced)';
const textSecondary = 'var(--builder-text-secondary, rgba(255, 255, 255, 0.56))';
const danger = '#ff6b6b';

export const PANEL_WIDTH_KEY = 'aiChat.panelWidth';
export const PANEL_MIN_WIDTH = 320;
export const PANEL_MAX_WIDTH = 720;
export const PANEL_DEFAULT_WIDTH = 360;
const KEYBOARD_STEP = 16;

const clampWidth = (width: number) => Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width)));

/** Ширина панели, запомненная в браузере; без хранилища — ширина по умолчанию. */
const readWidth = () => {
    try {
        const stored = Number(localStorage.getItem(PANEL_WIDTH_KEY));
        return stored ? clampWidth(stored) : PANEL_DEFAULT_WIDTH;
    } catch {
        return PANEL_DEFAULT_WIDTH;
    }
};

const usePanelWidth = () => {
    const [width, setWidth] = useState(readWidth);
    useEffect(() => {
        try {
            localStorage.setItem(PANEL_WIDTH_KEY, String(width));
        } catch {
            // Хранилище недоступно: ширина живёт до перезагрузки.
        }
    }, [width]);
    return [width, (next: number) => setWidth(clampWidth(next))] as const;
};

const Root = styled.aside<{ $open: boolean }>`
    position: relative;
    display: ${({ $open }) => ($open ? 'flex' : 'none')};
    flex-direction: column;
    flex-shrink: 0;
    min-width: 0;
    max-height: 100%;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    background: var(--builder-bg-primary, #27282c);
    color: var(--builder-text-primary, #fff);
    font:
        400 13px/18px Inter,
        system-ui,
        sans-serif;
`;
/** Левый край панели: тянется мышью и стрелками клавиатуры. */
const ResizeHandle = styled.div`
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 6px;
    cursor: col-resize;
    z-index: 1;
    &:hover,
    &:focus-visible {
        background: ${accent};
        outline: none;
    }
`;
const Header = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    gap: 8px;
`;
const Warning = styled.p`
    margin: 0 16px 8px;
    color: ${textSecondary};
    font-size: 12px;
`;
const Intro = styled.li`
    color: ${textSecondary};
    font-size: 12px;
`;
const Feed = styled.ol`
    flex: 1;
    margin: 0;
    padding: 0 16px;
    overflow-y: auto;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
const Bubble = styled.li<{ $own?: boolean }>`
    align-self: ${({ $own }) => ($own ? 'flex-end' : 'flex-start')};
    max-width: 90%;
    padding: 8px 10px;
    border-radius: 8px;
    background: ${({ $own }) => ($own ? accent : 'rgba(255, 255, 255, 0.08)')};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;
const Answer = styled.li`
    align-self: flex-start;
    max-width: 90%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
`;
/** Фон ответа — как у полей инспектора редактора. */
const AnswerText = styled.div`
    padding: 8px 10px;
    border-radius: 8px;
    background: #383a40;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;
const pulse = keyframes`
    50% { opacity: 0.3; }
`;
const Step = styled.li<{ $state: 'running' | 'done' | 'failed' }>`
    display: flex;
    align-items: baseline;
    gap: 8px;
    color: ${({ $state }) => ($state === 'failed' ? danger : textSecondary)};
    font-size: 12px;
`;
const Marker = styled.span<{ $state: 'running' | 'done' | 'failed' }>`
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transform: translateY(-1px);
    background: ${({ $state }) => ($state === 'failed' ? danger : $state === 'done' ? textSecondary : accent)};
    ${({ $state }) =>
        $state === 'running' &&
        css`
            animation: ${pulse} 1s ease-in-out infinite;
        `}
`;
const Notice = styled.li<{ $tone: string }>`
    padding: 6px 8px;
    border-radius: 6px;
    background: ${({ $tone }) => ($tone === 'error' ? 'rgba(255, 107, 107, 0.16)' : 'rgba(255, 255, 255, 0.06)')};
`;
const Confirm = styled.div`
    margin: 8px 16px;
    padding: 10px;
    border: 1px solid ${accent};
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
const Arguments = styled.pre`
    margin: 0;
    max-height: 160px;
    overflow: auto;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    font:
        12px/16px ui-monospace,
        monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;
const Row = styled.div`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
`;
const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
`;
/** Поле ввода с иконкой отправки; рамка у обёртки, у самого поля её нет. */
const Composer = styled.div`
    position: relative;
    display: flex;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    &:focus-within {
        border-color: ${accent};
    }
`;
const Input = styled.textarea`
    flex: 1;
    min-height: 64px;
    resize: vertical;
    padding: 8px 40px 8px 8px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    &,
    &:focus,
    &:focus-visible {
        outline: none !important;
        box-shadow: none !important;
    }
`;
const IconAction = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${textSecondary};
    cursor: pointer;
    &:hover {
        color: var(--builder-text-primary, #fff);
        background: rgba(255, 255, 255, 0.08);
    }
`;
const SendButton = styled(IconAction)`
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 28px;
    height: 28px;
    background: ${accent};
    color: #fff;
    &:hover {
        background: ${accent};
        filter: brightness(1.1);
    }
    &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
        filter: none;
    }
`;
const Action = styled.button<{ $primary?: boolean }>`
    min-height: 28px;
    padding: 4px 10px;
    border: 0;
    border-radius: 6px;
    background: ${({ $primary }) => ($primary ? accent : 'rgba(255, 255, 255, 0.08)')};
    color: #fff;
    font: inherit;
    cursor: pointer;
    &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
    }
`;

const COPIED_MS = 1500;
/** Доля предела истории, после которой панель предупреждает о длинном разговоре. */
export const LONG_CONVERSATION_RATIO = 0.8;

const LongConversation = styled.p`
    margin: 0;
    color: ${textSecondary};
    font-size: 12px;
`;

/** Кнопка копирования ответа; после копирования ненадолго показывает галочку. */
const CopyAnswer = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(timer.current), []);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            return;
        }
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    };
    return (
        <IconAction
            type="button"
            aria-label={copied ? 'Ответ скопирован' : 'Скопировать ответ'}
            title={copied ? 'Скопировано' : 'Скопировать'}
            onClick={() => void copy()}
        >
            {copied ? <DoneOutline aria-hidden /> : <CopyOutline aria-hidden />}
        </IconAction>
    );
};

/** Панель ИИ-чата в рабочей области дизайн-системы. */
export const AiChatPanel = ({ projectId, designSystemId, getContext, open, onClose }: AiChatPanelProps) => {
    const chat = useAiChat({ projectId, designSystemId, getContext });
    const [draft, setDraft] = useState('');
    const [width, setWidth] = usePanelWidth();
    const maxChars = chat.status?.messageMaxChars;

    const startResize = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            event.preventDefault();
            const startX = event.clientX;
            const startWidth = width;
            // Край слева: движение влево расширяет панель.
            const move = (moveEvent: globalThis.PointerEvent) => setWidth(startWidth + startX - moveEvent.clientX);
            const stop = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop);
        },
        [setWidth, width],
    );
    const resizeByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') setWidth(width + KEYBOARD_STEP);
        else if (event.key === 'ArrowRight') setWidth(width - KEYBOARD_STEP);
        else return;
        event.preventDefault();
    };

    if (!chat.status) return null;

    const handle = (
        <ResizeHandle
            role="separator"
            aria-orientation="vertical"
            aria-label="Ширина панели ИИ-ассистента"
            aria-valuemin={PANEL_MIN_WIDTH}
            aria-valuemax={PANEL_MAX_WIDTH}
            aria-valuenow={width}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={resizeByKeyboard}
        />
    );
    const close = (
        <IconAction type="button" onClick={onClose} aria-label="Закрыть чат">
            ✕
        </IconAction>
    );

    if (!chat.status.enabled) {
        return (
            <Root $open={open} style={{ width }} aria-label="ИИ-ассистент">
                {handle}
                <Header>
                    <strong>ИИ-ассистент</strong>
                    {close}
                </Header>
                <Warning>Ассистент недоступен.</Warning>
            </Root>
        );
    }

    const canSend = !chat.running && Boolean(draft.trim());
    const historyMaxChars = chat.status.historyMaxChars;
    const longConversation = Boolean(historyMaxChars && chat.historyChars >= historyMaxChars * LONG_CONVERSATION_RATIO);
    const submit = async () => {
        const text = draft.trim();
        if (!text || chat.running) return;
        setDraft('');
        const accepted = await chat.send(text);
        if (!accepted) setDraft((current) => current || text);
    };

    return (
        <Root $open={open} style={{ width }} aria-label="ИИ-ассистент">
            {handle}
            <Header>
                <strong>ИИ-ассистент</strong>
                <Row>
                    <Action type="button" onClick={chat.reset} disabled={chat.running}>
                        Новый чат
                    </Action>
                    {close}
                </Row>
            </Header>
            <Feed aria-live="polite">
                {/* Первая запись ленты, а не закреплённая шапка: уезжает вверх вместе с разговором. */}
                <Intro>Запросы и данные дизайн-системы передаются внешнему провайдеру модели.</Intro>
                {chat.items.map((item) => {
                    switch (item.kind) {
                        case 'user':
                            return (
                                <Bubble key={item.id} $own>
                                    {item.text}
                                </Bubble>
                            );
                        case 'assistant':
                            return (
                                <Answer key={item.id}>
                                    <AnswerText>{item.text}</AnswerText>
                                    <CopyAnswer text={item.text} />
                                </Answer>
                            );
                        case 'step':
                            return (
                                <Step key={item.id} $state={item.state}>
                                    <Marker $state={item.state} aria-hidden />
                                    <span>
                                        {item.label}
                                        {item.detail ? ` — ${item.detail}` : ''}
                                    </span>
                                </Step>
                            );
                        case 'notice':
                            return (
                                <Notice
                                    key={item.id}
                                    $tone={item.tone}
                                    role={item.tone === 'error' ? 'alert' : 'status'}
                                >
                                    {item.text}
                                </Notice>
                            );
                    }
                })}
            </Feed>
            {chat.pending && (
                <Confirm role="dialog" aria-label="Подтверждение операции">
                    <span>
                        {chat.pending.reason === 'destructive'
                            ? 'Агент хочет выполнить удаляющую операцию:'
                            : 'Агент сделал много изменений за один запрос и хочет продолжить:'}{' '}
                        <strong>{toolLabel(chat.pending.tool)}</strong>
                    </span>
                    <Arguments aria-label="Аргументы операции">
                        {JSON.stringify(chat.pending.arguments, null, 2)}
                    </Arguments>
                    <Row>
                        <Action type="button" $primary onClick={() => void chat.decide(true)}>
                            Подтвердить
                        </Action>
                        <Action type="button" onClick={() => void chat.decide(false)}>
                            Отклонить
                        </Action>
                    </Row>
                </Confirm>
            )}
            <Form
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                {longConversation && (
                    <LongConversation role="status">
                        Разговор становится длинным - ассистент может забыть его начало. Лучше начать новый чат.
                    </LongConversation>
                )}
                <Composer>
                    <Input
                        aria-label="Сообщение ассистенту"
                        placeholder="Например: перекрась кнопку в красный"
                        value={draft}
                        maxLength={maxChars}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void submit();
                            }
                        }}
                    />
                    {/* Пока идёт ход, на месте отправки — остановка. */}
                    {chat.running || chat.foreignTurn ? (
                        <SendButton
                            key="stop"
                            type="button"
                            aria-label="Остановить"
                            title="Остановить"
                            onClick={() => void chat.stop()}
                        >
                            <StopFill aria-hidden />
                        </SendButton>
                    ) : (
                        <SendButton
                            key="send"
                            type="submit"
                            aria-label="Отправить"
                            title="Отправить"
                            disabled={!canSend}
                        >
                            <ArrowUpOutline aria-hidden />
                        </SendButton>
                    )}
                </Composer>
            </Form>
        </Root>
    );
};
