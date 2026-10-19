import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewPayloadInput } from '../../../../composePreview';
import { ComposePayloadDebug } from './ComposePayloadDebug';

const payload = {
    protocolVersion: 1,
    platform: 'COMPOSE',
    assets: [],
    theme: { 'color.background': { type: 'color', value: '#112233FF' } },
    component: { id: 'BasicButton', variations: {}, properties: {} },
    example: { id: 'BasicButton', props: { label: 'Hello' } },
    surface: { width: 360, height: 160, background: '#FFFFFFFF' },
} as unknown as PreviewPayloadInput;
const expectedJson = JSON.stringify(payload, null, 2);

describe('ComposePayloadDebug', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        cleanup();
    });

    it('is collapsed by default and shows the formatted payload once expanded', () => {
        render(<ComposePayloadDebug payload={payload} />);

        expect(screen.queryByTestId('compose-payload-json')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Payload/ }));

        expect(screen.getByTestId('compose-payload-json').textContent).toBe(expectedJson);
        expect(screen.getByRole('button', { name: /Payload/ })).toHaveAttribute('aria-expanded', 'true');
    });

    it('counts the payloads it has been given, by object identity', () => {
        const { rerender } = render(<ComposePayloadDebug payload={payload} />);

        expect(screen.getByTestId('compose-payload-count')).toHaveTextContent('1');

        // Тот же объект: новый payload не собирался.
        rerender(<ComposePayloadDebug payload={payload} />);
        expect(screen.getByTestId('compose-payload-count')).toHaveTextContent('1');

        // Новый объект (пусть с тем же содержимым): `ComposePreviewFrame` отправит его в плагин.
        rerender(<ComposePayloadDebug payload={{ ...payload }} />);
        expect(screen.getByTestId('compose-payload-count')).toHaveTextContent('2');

        rerender(<ComposePayloadDebug payload={{ ...payload, surface: { width: 1, height: 1, background: '#000000FF' } }} />);
        expect(screen.getByTestId('compose-payload-count')).toHaveTextContent('3');
    });

    it('collapses again', () => {
        render(<ComposePayloadDebug payload={payload} />);
        const toggle = screen.getByRole('button', { name: /Payload/ });

        fireEvent.click(toggle);
        fireEvent.click(toggle);

        expect(screen.queryByTestId('compose-payload-json')).not.toBeInTheDocument();
    });

    it('copies the formatted payload even while collapsed and confirms it', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        render(<ComposePayloadDebug payload={payload} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Копировать' }));
        });

        expect(writeText).toHaveBeenCalledWith(expectedJson);
        expect(screen.getByRole('status')).toHaveTextContent('Скопировано');

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('reports a failed copy and keeps working', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        render(<ComposePayloadDebug payload={payload} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Копировать' }));
        });

        expect(screen.getByRole('alert')).toHaveTextContent('Не удалось скопировать');
        fireEvent.click(screen.getByRole('button', { name: /Payload/ }));
        expect(screen.getByTestId('compose-payload-json')).toBeInTheDocument();
    });

    it('falls back to a temporary textarea without the Clipboard API', async () => {
        vi.stubGlobal('navigator', {});
        const execCommand = vi.fn().mockReturnValue(true);
        Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
        render(<ComposePayloadDebug payload={payload} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Копировать' }));
        });

        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(screen.getByRole('status')).toHaveTextContent('Скопировано');
        expect(document.querySelector('textarea')).toBeNull();
    });
});
