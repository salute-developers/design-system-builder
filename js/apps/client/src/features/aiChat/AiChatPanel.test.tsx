import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '../../api/aiChat';
import { AiChatError, type AiScreenContext } from '../../api/aiChat';
import type { AiChatEvent, AiChatMessage } from '../../api/aiChat';
import { authService } from '../../api/authService';
import { AiChatPanel } from './AiChatPanel';
import { useAiChat } from './useAiChat';

const status = { enabled: true, model: 'glm-4.5-flash', messageMaxChars: 10 };

const streamOf =
    (...events: AiChatEvent[]) =>
    async ({ received }: { received: (event: AiChatEvent, id: number) => void }) => {
        events.forEach((event, index) => received(event, index + 1));
    };

describe('ai chat panel', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.spyOn(api, 'getAiChatStatus').mockResolvedValue(status);
        vi.spyOn(api, 'stopAiTurn').mockResolvedValue();
        vi.spyOn(authService, 'refreshAccessToken').mockResolvedValue('token');
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    const hook = () =>
        renderHook(() => useAiChat({ projectId: 'p', designSystemId: 'ds', newKey: () => `key-${Math.random()}` }));

    it('sends the current screen context with each turn and keeps it out of history', async () => {
        const start = vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf({ type: 'state', messages: [{ role: 'user', text: 'a' }] }, { type: 'done' }),
        );
        let context: AiScreenContext = {
            section: 'components',
            tenantId: 't1',
            component: {
                name: 'Button',
                appearanceId: 'a1',
                selectedValues: [{ variation: 'view', value: 'accent', styleId: 's1' }],
            },
        };
        const { result } = renderHook(() =>
            useAiChat({ projectId: 'p', designSystemId: 'ds', getContext: () => context, newKey: () => 'k' }),
        );
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));

        await act(() => result.current.send('сделай её красной'));
        expect(start.mock.calls[0][0].context).toEqual(context);
        expect(JSON.stringify(start.mock.calls[0][0].messages)).not.toContain('Button');

        context = { section: 'typography', tenantId: 't1', token: { id: 'tok', name: 'screen-l.body.m.normal' } };
        await act(() => result.current.send('увеличь шрифт'));
        expect(start.mock.calls[1][0].context).toEqual(context);
    });

    it('copies an answer to the clipboard', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf({ type: 'message', text: 'Готово' }, { type: 'done' }),
        );
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        fireEvent.change(input, { target: { value: 'x' } });
        fireEvent.click(screen.getByLabelText('Отправить'));

        fireEvent.click(await screen.findByLabelText('Скопировать ответ'));
        expect(writeText).toHaveBeenCalledWith('Готово');
        await screen.findByLabelText('Ответ скопирован');
    });

    it('resizes by keyboard within limits and remembers the width', async () => {
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const handle = await screen.findByRole('separator', { name: 'Ширина панели ИИ-ассистента' });
        expect(handle.getAttribute('aria-valuenow')).toBe('360');

        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
        expect(handle.getAttribute('aria-valuenow')).toBe('376');
        expect(localStorage.getItem('aiChat.panelWidth')).toBe('376');
        for (let i = 0; i < 50; i++) fireEvent.keyDown(handle, { key: 'ArrowLeft' });
        expect(handle.getAttribute('aria-valuenow')).toBe('720');
        cleanup();

        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const reopened = await screen.findByRole('separator', { name: 'Ширина панели ИИ-ассистента' });
        expect(reopened.getAttribute('aria-valuenow')).toBe('720');
    });

    it('sends by the icon only when there is text', async () => {
        const start = vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(streamOf({ type: 'done' }));
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        const send = screen.getByLabelText('Отправить') as HTMLButtonElement;
        expect(send.disabled).toBe(true);

        fireEvent.change(input, { target: { value: 'привет' } });
        expect(send.disabled).toBe(false);
        fireEvent.click(send);
        await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    });

    it('warns about a long conversation near the history limit and clears it with a new chat', async () => {
        vi.mocked(api.getAiChatStatus).mockResolvedValue({ ...status, historyMaxChars: 1000 });
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        const long: AiChatMessage[] = [
            { role: 'user', text: 'x' },
            { role: 'assistant', text: 'я'.repeat(850) },
        ];
        vi.spyOn(api, 'streamAiTurn').mockImplementation(streamOf({ type: 'state', messages: long }, { type: 'done' }));
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        expect(screen.queryByText(/Разговор становится длинным/)).toBeNull();

        fireEvent.change(input, { target: { value: 'x' } });
        fireEvent.click(screen.getByLabelText('Отправить'));
        await screen.findByText(/Разговор становится длинным/);

        fireEvent.click(screen.getByText('Новый чат'));
        await waitFor(() => expect(screen.queryByText(/Разговор становится длинным/)).toBeNull());
    });

    it('does not warn without historyMaxChars in the status', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf({ type: 'state', messages: [{ role: 'assistant', text: 'я'.repeat(5000) }] }, { type: 'done' }),
        );
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        fireEvent.change(input, { target: { value: 'x' } });
        fireEvent.click(screen.getByLabelText('Отправить'));
        await waitFor(() => expect(api.streamAiTurn).toHaveBeenCalled());
        expect(screen.queryByText(/Разговор становится длинным/)).toBeNull();
    });

    it('says the assistant is unavailable when the server disables chat', async () => {
        vi.mocked(api.getAiChatStatus).mockResolvedValue({ enabled: false });
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        await screen.findByText('Ассистент недоступен.');
        expect(screen.queryByLabelText('Сообщение ассистенту')).toBeNull();
    });

    it('keeps a rejected message out of the feed and shows the hourly limit wait', async () => {
        vi.spyOn(api, 'startAiTurn').mockRejectedValue(new AiChatError(429, 'ai_turn_limit', {}, 61));
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = (await screen.findByLabelText('Сообщение ассистенту')) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: 'привет' } });
        fireEvent.click(screen.getByLabelText('Отправить'));

        await screen.findByText(/через 2 мин/);
        expect(input.value).toBe('привет');
        expect(screen.queryAllByText('привет', { selector: 'li' })).toHaveLength(0);
    });

    it('keeps the message with an interrupted marker when the network never answers', async () => {
        vi.spyOn(api, 'startAiTurn').mockRejectedValue(new AiChatError(0, 'network_error'));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        const accepted = await act(() => result.current.send('a'));

        expect(accepted).toBe(true);
        expect(result.current.historySnapshot()).toEqual([{ role: 'user', text: 'a' }, { role: 'interrupted' }]);
        expect(result.current.items[0]).toMatchObject({ kind: 'user', text: 'a' });
    });

    it('explains turn_limit_reached after a decision and access_revoked', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf(
                { type: 'tool_result', callId: 'c1', tool: 'component_property_reset', isError: false, summary: '' },
                { type: 'error', code: 'turn_limit_reached', message: '' },
                { type: 'error', code: 'access_revoked', message: '' },
                { type: 'done' },
            ),
        );
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('x'));

        const notices = result.current.items.filter((item) => item.kind === 'notice').map((item) => item.text);
        expect(result.current.items.some((item) => item.kind === 'step' && item.state === 'done')).toBe(true);
        expect(notices[0]).toContain('Продолжить разговор можно позже');
        expect(notices[1]).toContain('Доступ к проекту отозван');
    });

    const confirmation: AiChatEvent = {
        type: 'confirmation_required',
        callId: 'c3',
        tool: 'component_property_reset',
        arguments: { appearanceId: 'a1' },
        reason: 'destructive',
        confirmationToken: 'tok',
        expiresAt: '',
    };

    it('keeps the confirmation card after a temporary rejection and drops it when expired', async () => {
        const start = vi.spyOn(api, 'startAiTurn').mockResolvedValueOnce('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(streamOf(confirmation, { type: 'done' }));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('сбрось'));

        start.mockRejectedValueOnce(new AiChatError(503, 'ai_overloaded'));
        await act(() => result.current.decide(true));
        expect(result.current.pending?.confirmationToken).toBe('tok');

        start.mockRejectedValueOnce(new AiChatError(410, 'confirmation_expired'));
        await act(() => result.current.decide(true));
        expect(result.current.pending).toBeNull();
    });

    it('keeps the confirmation card when the decision never reaches the server', async () => {
        const start = vi.spyOn(api, 'startAiTurn').mockResolvedValueOnce('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(streamOf(confirmation, { type: 'done' }));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('сбрось'));

        start.mockRejectedValueOnce(new AiChatError(0, 'network_error'));
        await act(() => result.current.decide(true));
        expect(result.current.pending?.confirmationToken).toBe('tok');
    });

    it('drops the confirmation card when a new message is accepted', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn')
            .mockImplementationOnce(streamOf(confirmation, { type: 'done' }))
            .mockImplementation(streamOf({ type: 'done' }));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('сбрось'));
        expect(result.current.pending).not.toBeNull();

        await act(() => result.current.send('нет, лучше другое'));
        expect(result.current.pending).toBeNull();
    });

    it('ignores the answer of a start that was reset while in flight', async () => {
        let accept: (turnId: string) => void = () => {};
        vi.spyOn(api, 'startAiTurn').mockImplementation(() => new Promise((resolve) => (accept = resolve)));
        const stream = vi.spyOn(api, 'streamAiTurn').mockImplementation(streamOf({ type: 'done' }));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));

        let sending: Promise<boolean> = Promise.resolve(true);
        act(() => {
            sending = result.current.send('старое');
        });
        await waitFor(() => expect(result.current.running).toBe(true));
        act(() => result.current.reset());
        await act(async () => {
            accept('turn-old');
            await sending;
        });

        expect(result.current.historySnapshot()).toEqual([]);
        expect(result.current.items).toEqual([]);
        expect(stream).not.toHaveBeenCalled();
    });

    it('keeps reading the turn while the panel is closed', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        let emit: (event: AiChatEvent, id: number) => void = () => {};
        let finish: () => void = () => {};
        vi.spyOn(api, 'streamAiTurn').mockImplementation(({ received }) => {
            emit = received;
            return new Promise<void>((resolve) => (finish = resolve));
        });
        const { rerender } = render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        fireEvent.change(input, { target: { value: 'привет' } });
        fireEvent.click(screen.getByLabelText('Отправить'));
        await screen.findByLabelText('Остановить');

        rerender(<AiChatPanel projectId="p" designSystemId="ds" open={false} onClose={() => {}} />);
        act(() => emit({ type: 'message', text: 'ответ без панели' }, 1));
        rerender(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);

        expect(screen.getByText('привет')).toBeTruthy();
        expect(screen.getByText('ответ без панели')).toBeTruthy();
        finish();
    });

    it('shows arguments and a confirm button on the card', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(streamOf(confirmation, { type: 'done' }));
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        fireEvent.change(input, { target: { value: 'сбрось' } });
        fireEvent.click(screen.getByLabelText('Отправить'));

        await screen.findByText('Подтвердить');
        expect(screen.getByLabelText('Аргументы операции').textContent).toContain('a1');
    });

    it('does not offer a decision for a confirmation of an attached turn', async () => {
        vi.spyOn(api, 'startAiTurn').mockRejectedValue(
            new AiChatError(429, 'ai_busy', { activeTurnId: 'turn-9', projectId: 'p', designSystemId: 'ds' }),
        );
        vi.spyOn(api, 'streamAiTurn').mockImplementation(streamOf(confirmation, { type: 'done' }));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('x'));

        await waitFor(() =>
            expect(result.current.items.some((item) => item.kind === 'notice' && item.text.includes('вкладке'))).toBe(
                true,
            ),
        );
        expect(result.current.pending).toBeNull();
    });

    it('stops a busy turn of another project through its project', async () => {
        vi.spyOn(api, 'startAiTurn').mockRejectedValue(
            new AiChatError(429, 'ai_busy', { activeTurnId: 'turn-9', projectId: 'p2', designSystemId: 'ds' }),
        );
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('x'));
        await act(() => result.current.stop());

        expect(api.stopAiTurn).toHaveBeenCalledWith('p2', 'turn-9');
    });

    it('starts a new conversation when the design system changes', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf({ type: 'state', messages: [{ role: 'user', text: 'a' }] }, { type: 'done' }),
        );
        const { result, rerender } = renderHook(
            ({ designSystemId }) => useAiChat({ projectId: 'p', designSystemId, newKey: () => 'k' }),
            { initialProps: { designSystemId: 'ds' } },
        );
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('a'));
        expect(result.current.items).not.toHaveLength(0);

        rerender({ designSystemId: 'ds-2' });
        await waitFor(() => expect(result.current.items).toHaveLength(0));
        expect(result.current.historySnapshot()).toEqual([]);
    });

    it('shows steps, takes history from state and keeps nothing in storage', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        const finalHistory: AiChatMessage[] = [
            { role: 'user', text: 'hi' },
            { role: 'assistant', text: 'готово' },
        ];
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf(
                { type: 'tool_started', callId: 'c1', tool: 'components_list', arguments: {} },
                { type: 'tool_result', callId: 'c1', tool: 'components_list', isError: false, summary: '' },
                { type: 'message', text: 'готово' },
                { type: 'state', messages: finalHistory },
                { type: 'done' },
            ),
        );
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('hi'));

        expect(result.current.items.map((item) => item.kind)).toEqual(['user', 'step', 'assistant']);
        expect(result.current.historySnapshot()).toEqual(finalHistory);
        expect(localStorage.length + sessionStorage.length).toBe(0);
    });

    it('marks an interrupted turn when the stream is lost and sends the marker with the next message', async () => {
        const start = vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockRejectedValueOnce(new AiChatError(404, 'turn_unknown'));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('a'));

        expect(result.current.historySnapshot().at(-1)).toEqual({ role: 'interrupted' });
        expect(result.current.items.some((item) => item.kind === 'notice' && item.text.includes('исход'))).toBe(true);

        vi.mocked(api.streamAiTurn).mockImplementation(streamOf({ type: 'done' }));
        await act(() => result.current.send('b'));
        const sent = start.mock.calls.at(-1)![0].messages;
        expect(sent.map((message) => message.role)).toEqual(['user', 'interrupted', 'user']);
    });

    it('attaches to a busy turn of the same design system without replacing history', async () => {
        vi.spyOn(api, 'startAiTurn').mockRejectedValue(
            new AiChatError(429, 'ai_busy', { activeTurnId: 'turn-9', projectId: 'p', designSystemId: 'ds' }),
        );
        const stream = vi
            .spyOn(api, 'streamAiTurn')
            .mockImplementation(
                streamOf({ type: 'state', messages: [{ role: 'user', text: 'чужое' }] }, { type: 'done' }),
            );
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        const accepted = await act(() => result.current.send('мой вопрос'));

        expect(accepted).toBe(false);
        expect(stream.mock.calls[0][0].turnId).toBe('turn-9');
        expect(result.current.historySnapshot()).toEqual([]);
    });

    it('shows a foreign tab turn with a stop action', async () => {
        vi.spyOn(api, 'startAiTurn').mockRejectedValue(
            new AiChatError(429, 'ai_busy', { activeTurnId: 'turn-9', projectId: 'p', designSystemId: 'other' }),
        );
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('x'));

        expect(result.current.foreignTurn).toBe(true);
        await act(() => result.current.stop());
        expect(api.stopAiTurn).toHaveBeenCalledWith('p', 'turn-9');
    });

    it('confirms an operation with the token and a new key', async () => {
        const start = vi.spyOn(api, 'startAiTurn').mockResolvedValueOnce('turn-1').mockResolvedValueOnce('turn-2');
        vi.spyOn(api, 'streamAiTurn')
            .mockImplementationOnce(
                streamOf(
                    {
                        type: 'confirmation_required',
                        callId: 'c3',
                        tool: 'component_property_reset',
                        arguments: {},
                        reason: 'destructive',
                        confirmationToken: 'tok',
                        expiresAt: '',
                    },
                    { type: 'state', messages: [{ role: 'user', text: 'сбрось' }] },
                    { type: 'done' },
                ),
            )
            .mockImplementation(streamOf({ type: 'done' }));
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('сбрось'));
        expect(result.current.pending?.tool).toBe('component_property_reset');

        await act(() => result.current.decide(true));
        const call = start.mock.calls[1][0];
        expect(call.confirmations).toEqual([{ confirmationToken: 'tok', approved: true }]);
        expect(call.idempotencyKey).not.toBe(start.mock.calls[0][0].idempotencyKey);
    });

    it('reports expired confirmation and too long history', async () => {
        const start = vi.spyOn(api, 'startAiTurn');
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));

        start.mockRejectedValueOnce(new AiChatError(410, 'confirmation_expired'));
        await act(() => result.current.send('a'));
        start.mockRejectedValueOnce(new AiChatError(413, 'http_413'));
        await act(() => result.current.send('b'));

        const notices = result.current.items.filter((item) => item.kind === 'notice').map((item) => item.text);
        expect(notices[0]).toContain('Подтверждение устарело');
        expect(notices[1]).toContain('Начните новый чат');
    });

    it('explains draft_changed and unknown outcome', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf(
                {
                    type: 'tool_result',
                    callId: 'c1',
                    tool: 'component_property_reset',
                    isError: true,
                    code: 'CONFLICT',
                    backendCode: 'draft_changed',
                    summary: '',
                },
                {
                    type: 'tool_result',
                    callId: 'c2',
                    tool: 'component_property_set',
                    isError: true,
                    code: 'OUTCOME_UNKNOWN',
                    summary: '',
                },
                { type: 'done' },
            ),
        );
        const { result } = hook();
        await waitFor(() => expect(result.current.status?.enabled).toBe(true));
        await act(() => result.current.send('x'));

        const details = result.current.items.flatMap((item) => (item.kind === 'step' ? [item.detail] : []));
        expect(details[0]).toContain('опубликовали');
        expect(details[1]).toContain('неизвестен');
    });

    it('limits the input length and stops the turn before logout', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        let release: () => void = () => {};
        vi.spyOn(api, 'streamAiTurn').mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        expect(input.getAttribute('maxlength')).toBe('10');

        fireEvent.change(input, { target: { value: 'привет' } });
        fireEvent.click(screen.getByLabelText('Отправить'));
        await screen.findByLabelText('Остановить');
        await act(() => authService.logout().catch(() => undefined));
        expect(api.stopAiTurn).toHaveBeenCalledWith('p', 'turn-1');
        release();
    });

    it('offers no journal revert action after a turn with writes', async () => {
        vi.spyOn(api, 'startAiTurn').mockResolvedValue('turn-1');
        vi.spyOn(api, 'streamAiTurn').mockImplementation(
            streamOf(
                { type: 'tool_result', callId: 'c1', tool: 'component_property_set', isError: false, summary: '' },
                { type: 'done' },
            ),
        );
        render(<AiChatPanel projectId="p" designSystemId="ds" open onClose={() => {}} />);
        const input = await screen.findByLabelText('Сообщение ассистенту');
        fireEvent.change(input, { target: { value: 'x' } });
        fireEvent.click(screen.getByLabelText('Отправить'));
        await screen.findByText(/Меняю свойство компонента/);
        expect(screen.queryByText(/Отменить/)).toBeNull();
    });
});
