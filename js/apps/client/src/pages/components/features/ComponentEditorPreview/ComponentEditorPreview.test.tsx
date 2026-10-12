import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewComponentDescription, PreviewPayloadInput } from '../../../../composePreview';
import { ComponentEditorPreview } from './ComponentEditorPreview';

const createDraft = vi.fn();
const payload: PreviewPayloadInput = {
    protocolVersion: 1,
    platform: 'COMPOSE',
    assets: [],
    theme: {},
    component: { id: 'BasicButton', variations: {}, properties: {} },
    example: { id: 'BasicButton', props: {} },
    surface: { width: 360, height: 160, background: '#FFFFFFFF' },
};
const description: PreviewComponentDescription = {
    protocolVersion: 1,
    componentId: 'BasicButton',
    storyId: 'BasicButton',
    properties: [
        { type: 'string', name: 'label', defaultValue: 'label' },
        { type: 'string', name: 'value', defaultValue: '' },
        { type: 'singleChoice', name: 'icon', defaultValue: 'Start', variants: ['Start', 'End', 'No'] },
        { type: 'singleChoice', name: 'spacing', defaultValue: 'Packed', variants: ['Packed', 'SpaceBetween'] },
        { type: 'boolean', name: 'hasFixedWidth', defaultValue: false },
        { type: 'boolean', name: 'enabled', defaultValue: true },
        { type: 'boolean', name: 'loading', defaultValue: false },
    ],
};
let emittedDescription = description;
let emitDescription: ((value: PreviewComponentDescription) => void) | undefined;

vi.mock('../../../../composePreview', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../composePreview')>();
    return {
        ...actual,
        getComposePreviewPluginUrl: () => 'https://plugin.example/',
        loadComposePreviewManifest: async () => ({
            manifest: { components: ['BasicButton'] },
        }),
        createComponentPreviewDraft: (options: unknown) => {
            createDraft(options);
            return { ok: true, draft: {} };
        },
        assembleComposePreviewPayload: () => ({ ok: true, payload }),
        ComposePreviewFrame: ({ onDescription }: { onDescription?: (value: PreviewComponentDescription) => void }) => {
            useEffect(() => {
                emitDescription = onDescription;
                onDescription?.(emittedDescription);
            }, [onDescription]);
            return <div data-testid="compose-frame" />;
        },
    };
});

vi.mock('../../../../hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../hooks')>();
    return {
        ...actual,
        useInputDynamicWidth: () => [100],
        useStory: () => ({
            storyArgs: [{ name: 'reactOnly', value: 'React' }],
            Story: () => <div>React story</div>,
        }),
    };
});

const config = {
    getName: () => 'Button',
    getVariations: () => [],
    getRevision: () => 1,
    getPreviewMetadata: () => ({ componentId: 'BasicButton', storyId: 'BasicButton' }),
};
const theme = {
    getTokenValue: () => '#FFFFFFFF',
    getRevision: () => 1,
};

const renderPreview = () =>
    render(
        <ComponentEditorPreview
            config={config as never}
            theme={theme as never}
            args={{ reactOnly: 'React', variant: 'variation-value' }}
            storyArgs={[]}
            storyItems={[]}
            selectedStory={{ label: '', value: '' }}
            componentVars={{}}
            themeVars={{}}
            themeModeList={[{ label: 'Светлый', value: 'light' }]}
            themeMode={{ label: 'Светлый', value: 'light' }}
            onStorySelect={vi.fn()}
            onUpdateThemeMode={vi.fn()}
            onChange={vi.fn()}
        />,
    );

describe('ComponentEditorPreview Compose controls', () => {
    beforeEach(() => {
        createDraft.mockClear();
        emittedDescription = description;
        emitDescription = undefined;
    });
    afterEach(cleanup);

    it('renders exactly the BasicButton descriptor controls and excludes React/variation props', async () => {
        renderPreview();
        fireEvent.click(await screen.findByText('Compose'));
        await screen.findByTestId('compose-frame');

        for (const label of ['Label', 'Value', 'Icon', 'Spacing', 'HasFixedWidth', 'Enabled', 'Loading']) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
        expect(screen.queryByText('ReactOnly')).not.toBeInTheDocument();
        expect(screen.queryByText('Variant')).not.toBeInTheDocument();

        await waitFor(() => {
            const latest = createDraft.mock.calls[createDraft.mock.calls.length - 1]?.[0] as {
                exampleProps: Record<string, unknown>;
            };
            expect(latest.exampleProps).toEqual({
                label: 'label',
                value: '',
                icon: 'Start',
                spacing: 'Packed',
                hasFixedWidth: false,
                enabled: true,
                loading: false,
            });
        });
    });

    it('updates typed Compose state without calling React or variation callbacks', async () => {
        const view = renderPreview();
        fireEvent.click(await screen.findByText('Compose'));
        const labelInput = await screen.findByDisplayValue('label');
        fireEvent.change(labelInput, { target: { value: 'Changed' } });

        await waitFor(() => {
            const latest = createDraft.mock.calls[createDraft.mock.calls.length - 1]?.[0] as {
                exampleProps: Record<string, unknown>;
            };
            expect(latest.exampleProps.label).toBe('Changed');
            expect(latest.exampleProps.enabled).toBe(true);
        });
        view.unmount();
    });

    it('parses numeric kinds and resets incompatible values when descriptor changes', async () => {
        emittedDescription = {
            ...description,
            properties: [
                { type: 'int', name: 'count', defaultValue: 2 },
                { type: 'float', name: 'ratio', defaultValue: 1.5 },
            ],
        };
        renderPreview();
        fireEvent.click(await screen.findByText('Compose'));
        fireEvent.change(await screen.findByDisplayValue('2'), { target: { value: '7' } });
        fireEvent.change(await screen.findByDisplayValue('1.5'), { target: { value: '2.25' } });

        await waitFor(() => {
            const latest = createDraft.mock.calls[createDraft.mock.calls.length - 1]?.[0] as {
                exampleProps: Record<string, unknown>;
            };
            expect(latest.exampleProps).toEqual({ count: 7, ratio: 2.25 });
        });

        await act(async () => {
            emitDescription?.({
                ...description,
                componentId: 'OtherButton',
                storyId: 'OtherButton',
                properties: [{ type: 'string', name: 'count', defaultValue: 'reset' }],
            });
        });
        await waitFor(() => {
            const latest = createDraft.mock.calls[createDraft.mock.calls.length - 1]?.[0] as {
                exampleProps: Record<string, unknown>;
            };
            expect(latest.exampleProps).toEqual({ count: 'reset' });
        });
    });
});
