import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
    PreviewComponentDescription,
    PreviewPayloadInput,
    WebPreviewPayloadOptions,
} from '../../../../composePreview';
import { ComponentEditorPreview } from './ComponentEditorPreview';

const WEB_PLUGIN_URL = 'http://localhost:3011/';

const description: PreviewComponentDescription = {
    protocolVersion: 1,
    componentId: 'Button',
    storyId: 'Default',
    properties: [
        { type: 'string', name: 'text', defaultValue: 'Hello' },
        { type: 'boolean', name: 'disabled', defaultValue: false },
        { type: 'singleChoice', name: 'stretching', defaultValue: 'auto', variants: ['auto', 'filled', 'fixed'] },
    ],
};

const pluginState = vi.hoisted(() => ({
    webUrl: undefined as string | undefined,
    wasmSupported: true,
    loadManifest: vi.fn(),
    slots: [] as Array<{ platform?: string; payload?: unknown; storyId?: string }>,
    /** Ответ плагина на `describe` с этим `storyId`. */
    describe: undefined as undefined | ((storyId?: string) => PreviewComponentDescription),
    /** Аргументы сборки web-payload: payload собирает общий ассемблер, здесь проверяется вход и путь до плагина. */
    webAssemblies: [] as WebPreviewPayloadOptions[],
    webFailure: undefined as string | undefined,
}));

vi.mock('../../../../composePreview', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../composePreview')>();
    return {
        ...actual,
        getComposePreviewPluginUrl: () => undefined,
        getWebPreviewPluginUrl: () => pluginState.webUrl,
        isComposePreviewEnvironmentSupported: () => pluginState.wasmSupported,
        loadComposePreviewManifest: (url: string, platform?: string) => pluginState.loadManifest(url, platform),
        // Compose-payload здесь не нужен: адреса Compose-плагина нет.
        createComponentPreviewDraft: () => ({ ok: false, diagnostics: [] }),
        assembleWebPreviewPayload: (options: WebPreviewPayloadOptions) => {
            pluginState.webAssemblies.push(options);
            if (pluginState.webFailure) {
                return { ok: false, diagnostics: [{ code: 'missing_token', message: pluginState.webFailure }] };
            }
            const payload: PreviewPayloadInput = {
                protocolVersion: 1,
                platform: 'WEB',
                assets: [],
                theme: {},
                component: { id: options.config.getName(), variations: { view: 'accent' }, properties: {} },
                example: { id: options.storyId, props: options.storyProps },
                surface: { width: 360, height: 160, background: options.backgroundToken },
            };
            return { ok: true, payload };
        },
        ComposePreviewSlot: ({
            platform,
            payload,
            storyId,
            onDescription,
        }: {
            platform?: string;
            payload?: unknown;
            storyId?: string;
            onDescription?: (value: PreviewComponentDescription) => void;
        }) => {
            pluginState.slots.push({ platform, payload, storyId });
            useEffect(() => {
                onDescription?.(pluginState.describe?.(storyId) ?? description);
            }, [onDescription, storyId]);
            return <div data-testid={`${platform ?? 'compose'}-frame`} />;
        },
    };
});

// Доступность web-плагина проверяет `useWebPreviewPlugin` через внутренние модули, минуя `index`.
vi.mock('../../../../composePreview/config', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../composePreview/config')>()),
    getWebPreviewPluginUrl: () => pluginState.webUrl,
}));
vi.mock('../../../../composePreview/manifest', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../composePreview/manifest')>()),
    loadComposePreviewManifest: (url: string, platform?: string) => pluginState.loadManifest(url, platform),
}));

vi.mock('../../../../hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../hooks')>();
    return { ...actual, useInputDynamicWidth: () => [100] };
});

const accentStyle = { getID: () => 'style-accent', getName: () => 'accent', getProps: () => ({ getList: () => [] }) };
const viewVariation = {
    getID: () => 'view',
    getName: () => 'view',
    isFlag: () => false,
    getStyles: () => [accentStyle],
};
const configOf = (name: string, platform: 'web' | 'compose' = 'web') => ({
    getName: () => name,
    getVariations: () => [viewVariation],
    getInvariants: () => ({ getList: () => [] }),
    getRevision: () => 1,
    getPlatform: () => platform,
    getPreviewMetadata: () => ({ componentId: undefined, storyId: undefined }),
});
const theme = {
    getTokenValue: (_name: string, type: string) => (type === 'fontFamily' ? { name: 'SB Sans Text' } : '#FFFFFFFF'),
    getTokens: () => [],
    getRevision: () => 1,
};

const previewElement = (config = configOf('Button')) => (
    <ComponentEditorPreview
        config={config as never}
        theme={theme as never}
        args={{ view: 'style-accent' }}
        themeModeList={[{ label: 'Тёмный', value: 'dark' }]}
        themeMode={{ label: 'Тёмный', value: 'dark' }}
        onUpdateThemeMode={vi.fn()}
        onChange={vi.fn()}
    />
);

const lastWebPayload = () =>
    pluginState.slots.filter((slot) => slot.platform === 'web' && slot.payload).at(-1)?.payload as
        | PreviewPayloadInput
        | undefined;

describe('ComponentEditorPreview web plugin', () => {
    beforeEach(() => {
        pluginState.webUrl = WEB_PLUGIN_URL;
        pluginState.wasmSupported = true;
        pluginState.loadManifest = vi.fn().mockResolvedValue({ manifest: { platform: 'web', components: ['Button'] } });
        pluginState.slots = [];
        pluginState.describe = undefined;
        pluginState.webAssemblies = [];
        pluginState.webFailure = undefined;
    });
    afterEach(() => {
        cleanup();
        localStorage.removeItem('debug_mode');
    });

    it('renders a web component listed by the web plugin manifest through the web host slot', async () => {
        render(previewElement());

        expect(await screen.findByTestId('web-frame')).toBeInTheDocument();
        expect(pluginState.loadManifest).toHaveBeenCalledWith(WEB_PLUGIN_URL, 'web');
        // React-рендерера нет: без Compose-метаданных переключателя рендереров тоже нет.
        expect(screen.queryByText('React')).not.toBeInTheDocument();
        expect(screen.queryByText('Renderer')).not.toBeInTheDocument();

        expect(lastWebPayload()).toMatchObject({
            platform: 'WEB',
            component: { id: 'Button', variations: { view: 'accent' } },
            example: { id: 'Default', props: {} },
            surface: { background: 'dark.background.default.primary' },
        });
        expect(lastWebPayload()).not.toHaveProperty('web');
        expect(pluginState.webAssemblies.at(-1)).toMatchObject({
            args: { view: 'style-accent' },
            themeMode: 'dark',
            backgroundToken: 'dark.background.default.primary',
        });
    });

    it('builds the story controls from the plugin description and sends only changed values', async () => {
        render(previewElement());
        await screen.findByTestId('web-frame');

        for (const label of ['Text', 'Disabled', 'Stretching']) {
            expect(await screen.findByText(label)).toBeInTheDocument();
        }
        // Вариации остаются в панели вместе с аргументами story плагина.
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(lastWebPayload()?.example.props).toEqual({});

        fireEvent.change(screen.getByDisplayValue('Hello'), { target: { value: 'Купить' } });

        await waitFor(() => expect(lastWebPayload()?.example).toEqual({ id: 'Default', props: { text: 'Купить' } }));
        expect(lastWebPayload()?.component.variations).toEqual({ view: 'accent' });
    });

    it('switches the plugin story: describes it by storyId, resets its arguments and sends its example.id', async () => {
        const stories = [
            { id: 'Default', name: 'Default' },
            { id: 'WithIcon', name: 'WithIcon' },
        ];
        const describeStory = vi.fn(
            (storyId?: string): PreviewComponentDescription =>
                storyId === 'WithIcon'
                    ? {
                          protocolVersion: 1,
                          componentId: 'Button',
                          storyId: 'WithIcon',
                          stories,
                          properties: [
                              { type: 'string', name: 'text', defaultValue: 'Icon' },
                              { type: 'boolean', name: 'iconRight', defaultValue: true },
                          ],
                      }
                    : { ...description, stories },
        );
        pluginState.describe = describeStory;

        render(previewElement());
        await screen.findByTestId('web-frame');
        expect(await screen.findByText('История')).toBeInTheDocument();
        expect(describeStory).toHaveBeenLastCalledWith(undefined);

        fireEvent.change(screen.getByDisplayValue('Hello'), { target: { value: 'Купить' } });
        await waitFor(() => expect(lastWebPayload()?.example).toEqual({ id: 'Default', props: { text: 'Купить' } }));

        fireEvent.click(screen.getByText('Default'));
        fireEvent.click(await screen.findByText('WithIcon'));

        await waitFor(() => expect(describeStory).toHaveBeenLastCalledWith('WithIcon'));
        expect(pluginState.slots.at(-1)?.storyId).toBe('WithIcon');
        // Аргументы прежней story не переносятся: панель новой story — значения по умолчанию из её описания.
        expect(await screen.findByDisplayValue('Icon')).toBeInTheDocument();
        expect(screen.getByText('IconRight')).toBeInTheDocument();
        expect(screen.queryByText('Stretching')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('Купить')).not.toBeInTheDocument();
        await waitFor(() => expect(lastWebPayload()?.example).toEqual({ id: 'WithIcon', props: {} }));
    });

    it('does not offer a story choice for a component with a single plugin story', async () => {
        pluginState.describe = () => ({ ...description, stories: [{ id: 'Default', name: 'Default' }] });

        render(previewElement());

        expect(await screen.findByText('Text')).toBeInTheDocument();
        expect(screen.queryByText('История')).not.toBeInTheDocument();
        expect(pluginState.slots.at(-1)?.storyId).toBeUndefined();
    });

    it('loads the web plugin without a WebAssembly check', async () => {
        pluginState.wasmSupported = false;

        render(previewElement());

        expect(await screen.findByTestId('web-frame')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows «Превью недоступно» without a web plugin URL and keeps the setup controls', async () => {
        pluginState.webUrl = undefined;

        render(previewElement());

        expect(screen.getByTestId('preview-unavailable')).toHaveTextContent(
            'Превью недоступно: адрес web-плагина превью не задан',
        );
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(screen.queryByTestId('web-frame')).not.toBeInTheDocument();
        expect(pluginState.loadManifest).not.toHaveBeenCalled();
    });

    it('shows «Превью недоступно» when the manifest does not list the component', async () => {
        render(previewElement(configOf('Checkbox')));

        expect(await screen.findByTestId('preview-unavailable')).toHaveTextContent(
            'компонент Checkbox не зарегистрирован в web-плагине',
        );
        expect(screen.queryByTestId('web-frame')).not.toBeInTheDocument();
        expect(screen.getByText('View')).toBeInTheDocument();
    });

    it('shows «Превью недоступно» with the reason when the manifest is rejected', async () => {
        pluginState.loadManifest = vi
            .fn()
            .mockRejectedValue(new Error('unsupported platform: expected web, got compose'));

        render(previewElement());

        expect(await screen.findByTestId('preview-unavailable')).toHaveTextContent(
            'манифест web-плагина не загрузился: unsupported platform: expected web, got compose',
        );
        expect(screen.queryByTestId('web-frame')).not.toBeInTheDocument();
    });

    it('shows the assembly diagnostic instead of the frame when the payload cannot be built', async () => {
        pluginState.webFailure = 'Theme token surface.x is missing';

        render(previewElement());

        expect(await screen.findByTestId('preview-unavailable')).toHaveTextContent(
            'Превью недоступно: Theme token surface.x is missing',
        );
        expect(screen.queryByTestId('web-frame')).not.toBeInTheDocument();
    });

    it('offers no React renderer in the debug mode and shows the WEB payload', async () => {
        localStorage.setItem('debug_mode', 'true');

        render(previewElement());

        expect(await screen.findByTestId('web-frame')).toBeInTheDocument();
        expect(screen.queryByText('React')).not.toBeInTheDocument();
        expect(screen.getByTestId('compose-payload-debug')).toBeInTheDocument();
    });

    it('does not load the web plugin manifest for a Compose component', async () => {
        render(previewElement(configOf('BasicButton', 'compose')));

        await Promise.resolve();
        expect(pluginState.loadManifest).not.toHaveBeenCalled();
        expect(screen.queryByTestId('web-frame')).not.toBeInTheDocument();
    });
});
