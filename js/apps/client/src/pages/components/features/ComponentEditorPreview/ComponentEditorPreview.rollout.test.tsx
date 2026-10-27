import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentEditorPreview } from './ComponentEditorPreview';

const pluginState = vi.hoisted(() => ({
    url: undefined as string | undefined,
    supported: true,
    loadManifest: vi.fn(),
    framePayloads: [] as unknown[],
}));

vi.mock('../../../../composePreview', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../composePreview')>();
    return {
        ...actual,
        getComposePreviewPluginUrl: () => pluginState.url,
        isComposePreviewEnvironmentSupported: () => pluginState.supported,
        loadComposePreviewManifest: (url: string) => pluginState.loadManifest(url),
        createComponentPreviewDraft: () => ({ ok: true, draft: {} }),
        assembleComposePreviewPayload: () => ({
            ok: true,
            payload: {
                protocolVersion: 1,
                platform: 'COMPOSE',
                assets: [],
                theme: {},
                component: { id: 'BasicButton', variations: {}, properties: {} },
                example: { id: 'BasicButton', props: {} },
                surface: { width: 360, height: 160, background: '#FFFFFFFF' },
            },
        }),
        ComposePreviewSlot: ({ payload }: { payload?: unknown }) => {
            if (payload && !pluginState.framePayloads.includes(payload)) pluginState.framePayloads.push(payload);
            return <div data-testid="compose-frame" />;
        },
    };
});

vi.mock('../../../../hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../hooks')>();
    return { ...actual, useInputDynamicWidth: () => [100] };
});

const storyProps = vi.fn();
const ReactStory = (props: unknown) => {
    storyProps(props);
    return <div>React story</div>;
};

const buttonConfig = {
    getName: () => 'Button',
    getVariations: () => [],
    getRevision: () => 1,
    getPlatform: () => 'web',
    getPreviewMetadata: () => ({ componentId: 'BasicButton', storyId: 'BasicButton' }),
};
const textConfig = {
    getName: () => 'Text',
    getVariations: () => [],
    getRevision: () => 1,
    getPlatform: () => 'web',
    getPreviewMetadata: () => ({ componentId: undefined, storyId: undefined }),
};
const composeConfig = {
    getName: () => 'BasicButton',
    getVariations: () => [],
    getRevision: () => 1,
    getPlatform: () => 'compose',
    getPreviewMetadata: () => ({ componentId: 'BasicButton', storyId: 'BasicButton' }),
};
const theme = { getTokenValue: () => '#FFFFFFFF', getRevision: () => 1 };

const previewElement = (config: unknown = buttonConfig, args: Record<string, unknown> = {}) => (
    <ComponentEditorPreview
        config={config as never}
        theme={theme as never}
        args={{ reactOnly: 'story-value', ...args }}
        storyArgs={[{ name: 'reactOnly', value: 'React' }] as never}
        Story={ReactStory}
        storyItems={[]}
        selectedStory={{ label: '', value: '' }}
        componentVars={{}}
        themeVars={{}}
        themeModeList={[{ label: 'Светлый', value: 'light' }]}
        themeMode={{ label: 'Светлый', value: 'light' }}
        onStorySelect={vi.fn()}
        onUpdateThemeMode={vi.fn()}
        onChange={vi.fn()}
    />
);

const lastStoryProps = () => storyProps.mock.calls[storyProps.mock.calls.length - 1][0];

describe('ComponentEditorPreview Compose rollout', () => {
    beforeEach(() => {
        pluginState.url = 'https://plugin.example/';
        pluginState.supported = true;
        pluginState.loadManifest = vi.fn().mockResolvedValue({ manifest: { components: ['BasicButton'] } });
        pluginState.framePayloads = [];
        storyProps.mockClear();
    });
    afterEach(cleanup);

    it('hands the frame one payload while the manifest loads and the editor state settles', async () => {
        render(previewElement(composeConfig));

        await screen.findByTestId('compose-frame');
        await waitFor(() => expect(pluginState.loadManifest).toHaveBeenCalled());
        await act(async () => {
            await Promise.resolve();
        });

        // Загрузка метаданных и сброс примеров не меняют содержимое payload, а значит, и сам объект.
        expect(pluginState.framePayloads).toHaveLength(1);
    });

    it('offers Compose when the plugin is configured, supported and lists the component', async () => {
        render(previewElement());

        expect(await screen.findByText('Compose')).toBeInTheDocument();
        expect(screen.getByText('React')).toBeInTheDocument();
    });

    it('renders a Compose component with the plugin only, without a renderer switch or React story', async () => {
        render(previewElement(composeConfig));

        expect(await screen.findByTestId('compose-frame')).toBeInTheDocument();
        expect(screen.queryByText('Renderer')).not.toBeInTheDocument();
        expect(screen.queryByText('React story')).not.toBeInTheDocument();
    });

    it('opens a Compose component missing from the plugin manifest with a diagnostic and without a frame', async () => {
        pluginState.loadManifest = vi.fn().mockResolvedValue({ manifest: { components: ['Other'] } });

        render(previewElement(composeConfig));

        expect(await screen.findByRole('alert')).toHaveTextContent('BasicButton не зарегистрирован в Compose-плагине');
        expect(screen.queryByTestId('compose-frame')).not.toBeInTheDocument();
    });

    it('explains an unsupported browser for a Compose component without suggesting React', async () => {
        pluginState.supported = false;

        render(previewElement(composeConfig));

        expect(await screen.findByRole('status')).toHaveTextContent('Compose-preview недоступен в этом браузере.');
        expect(screen.getByRole('status')).not.toHaveTextContent('React');
        expect(screen.queryByTestId('compose-frame')).not.toBeInTheDocument();
    });

    describe('payload debug block', () => {
        afterEach(() => {
            localStorage.removeItem('debug_mode');
        });

        it('is not shown outside the debug mode', async () => {
            render(previewElement(composeConfig));

            await screen.findByTestId('compose-frame');
            expect(screen.queryByTestId('compose-payload-debug')).not.toBeInTheDocument();
        });

        it('is shown under a Compose component in the debug mode', async () => {
            localStorage.setItem('debug_mode', 'true');

            render(previewElement(composeConfig));

            expect(await screen.findByTestId('compose-payload-debug')).toBeInTheDocument();
        });

        it('is not shown for a web component in the debug mode', async () => {
            localStorage.setItem('debug_mode', 'true');

            render(previewElement());
            await screen.findByText('Compose');

            expect(screen.queryByTestId('compose-payload-debug')).not.toBeInTheDocument();
        });
    });

    it('does not offer Compose and does not load a manifest without a plugin URL', async () => {
        pluginState.url = undefined;

        render(previewElement());

        expect(screen.getByText('React')).toBeInTheDocument();
        expect(screen.queryByText('Compose')).not.toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(pluginState.loadManifest).not.toHaveBeenCalled();
    });

    it('does not load the plugin and explains why in an unsupported browser', async () => {
        pluginState.supported = false;

        render(previewElement());

        expect(await screen.findByRole('status')).toHaveTextContent('Compose-preview недоступен в этом браузере');
        expect(screen.queryByText('Compose')).not.toBeInTheDocument();
        expect(screen.getByText('React story')).toBeInTheDocument();
        expect(pluginState.loadManifest).not.toHaveBeenCalled();
    });

    it('does not show the unsupported-browser notice for a component without Compose metadata', () => {
        pluginState.supported = false;

        render(previewElement(textConfig));

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('React story')).toBeInTheDocument();
    });

    it('keeps React preview when the manifest cannot be loaded', async () => {
        pluginState.loadManifest = vi.fn().mockRejectedValue(new Error('HTTP 503'));

        render(previewElement());

        await waitFor(() => expect(pluginState.loadManifest).toHaveBeenCalled());
        expect(screen.queryByText('Compose')).not.toBeInTheDocument();
        expect(screen.getByText('React story')).toBeInTheDocument();
    });

    it('does not offer Compose when the manifest lists only other components', async () => {
        pluginState.loadManifest = vi.fn().mockResolvedValue({ manifest: { components: ['Checkbox'] } });

        render(previewElement());

        await waitFor(() => expect(pluginState.loadManifest).toHaveBeenCalled());
        expect(screen.queryByText('Compose')).not.toBeInTheDocument();
        expect(screen.getByText('React story')).toBeInTheDocument();
    });

    it('returns to React preview and its controls when the user leaves Compose', async () => {
        render(previewElement());

        fireEvent.click(await screen.findByText('Compose'));
        expect(await screen.findByTestId('compose-frame')).toBeInTheDocument();
        expect(screen.queryByText('React story')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('React'));

        expect(await screen.findByText('React story')).toBeInTheDocument();
        expect(screen.queryByTestId('compose-frame')).not.toBeInTheDocument();
        expect(screen.getByText('ReactOnly')).toBeInTheDocument();
    });

    it('falls back to React preview and its controls when the user moves from Compose to a component without it', async () => {
        const { rerender } = render(previewElement());
        fireEvent.click(await screen.findByText('Compose'));
        expect(await screen.findByTestId('compose-frame')).toBeInTheDocument();

        rerender(previewElement(textConfig));

        expect(await screen.findByText('React story')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText('Compose')).not.toBeInTheDocument());
        expect(screen.queryByTestId('compose-frame')).not.toBeInTheDocument();
        expect(screen.getByText('ReactOnly')).toBeInTheDocument();
    });

    it('does not switch back to Compose by itself when the user returns to the component', async () => {
        const { rerender } = render(previewElement());
        fireEvent.click(await screen.findByText('Compose'));
        await screen.findByTestId('compose-frame');
        rerender(previewElement(textConfig));
        await waitFor(() => expect(screen.queryByText('Compose')).not.toBeInTheDocument());

        rerender(previewElement(buttonConfig));

        expect(await screen.findByText('Compose')).toBeInTheDocument();
        expect(screen.getByText('React story')).toBeInTheDocument();
        expect(screen.queryByTestId('compose-frame')).not.toBeInTheDocument();
    });

    it('gives the React story the same props after using Compose as in a run without the plugin', async () => {
        const argsAfterEdit = { text: 'Changed', disabled: true };

        const { rerender } = render(previewElement(buttonConfig, { text: 'Initial', disabled: false }));
        fireEvent.click(await screen.findByText('Compose'));
        await screen.findByTestId('compose-frame');
        rerender(previewElement(buttonConfig, argsAfterEdit));
        fireEvent.click(screen.getByText('React'));
        await screen.findByText('React story');
        const afterCompose = lastStoryProps();
        cleanup();

        pluginState.url = undefined;
        storyProps.mockClear();
        render(previewElement(buttonConfig, argsAfterEdit));
        await screen.findByText('React story');

        expect(afterCompose).toEqual(lastStoryProps());
        expect(afterCompose).toMatchObject(argsAfterEdit);
    });
});
