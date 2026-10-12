import { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { ComposePreviewFrame } from './ComposePreviewFrame';
import { assembleComposePreviewPayload } from './assembler';
import { getComposePreviewPluginUrl } from './config';
import { createPreviewDraftFixture } from './testDraftFixture';
import type { PreviewComponentDescription } from './types';

const SmokeApp = () => {
    const [revision, setRevision] = useState(0);
    const [description, setDescription] = useState<PreviewComponentDescription>();
    const [exampleProps, setExampleProps] = useState<Record<string, string | boolean | number>>({});
    const assembled = useMemo(() => {
        const draft = createPreviewDraftFixture();
        const fontFamily = draft.themeTokens.find((token) => token.id === 'font.body');
        if (fontFamily) {
            fontFamily.values.web = { name: 'System', fonts: [] };
        }
        if (revision > 0) {
            draft.variationSelections.customAxis = 'comfortable';
            draft.example.props = {
                ...draft.example.props,
                label: 'Second render',
                loading: true,
                enabled: false,
            };
            draft.themeTokens.find((token) => token.id === 'light.color.background')!.values.web = '#E53935';
            draft.themeTokens.find((token) => token.id === 'light.color.pressed')!.values.web = '#8E0000';
            draft.themeTokens.find((token) => token.id === 'size.height')!.values.web = 52;
            draft.themeTokens.find((token) => token.id === 'shape.button')!.values.web = 16;
        }
        draft.example.props = { ...draft.example.props, ...exampleProps };
        return assembleComposePreviewPayload(draft);
    }, [revision, exampleProps]);
    const pluginUrl = getComposePreviewPluginUrl();
    const onDescription = useCallback((nextDescription: PreviewComponentDescription) => {
        setDescription(nextDescription);
        setExampleProps(Object.fromEntries(
            nextDescription.properties.map((property) => [property.name, property.defaultValue]),
        ));
    }, []);

    if (!pluginUrl) return <p role="alert">VITE_COMPOSE_PREVIEW_PLUGIN_URL is not configured</p>;
    if (!assembled.ok) return <p role="alert">{assembled.diagnostics[0]?.message}</p>;

    return (
        <main style={{ width: 600, height: 400 }}>
            <button type="button" onClick={() => setRevision((value) => value + 1)}>
                Apply editor changes
            </button>
            {description?.properties.map((property) => {
                const value = exampleProps[property.name] ?? property.defaultValue;
                if (property.type === 'boolean') {
                    return (
                        <label key={property.name}>
                            {property.name}
                            <input
                                aria-label={property.name}
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(event) =>
                                    setExampleProps((current) => ({ ...current, [property.name]: event.target.checked }))
                                }
                            />
                        </label>
                    );
                }
                if (property.type === 'singleChoice') {
                    return (
                        <label key={property.name}>
                            {property.name}
                            <select
                                aria-label={property.name}
                                value={String(value)}
                                onChange={(event) =>
                                    setExampleProps((current) => ({ ...current, [property.name]: event.target.value }))
                                }
                            >
                                {property.variants.map((variant) => <option key={variant}>{variant}</option>)}
                            </select>
                        </label>
                    );
                }
                return (
                    <label key={property.name}>
                        {property.name}
                        <input
                            aria-label={property.name}
                            type={property.type === 'string' ? 'text' : 'number'}
                            value={String(value)}
                            onChange={(event) => {
                                const nextValue = property.type === 'string'
                                    ? event.target.value
                                    : Number(event.target.value);
                                setExampleProps((current) => ({ ...current, [property.name]: nextValue }));
                            }}
                        />
                    </label>
                );
            })}
            <output
                data-testid="payload-state"
                data-background={assembled.payload.theme['color.background']?.type === 'color'
                    ? assembled.payload.theme['color.background'].value
                    : ''}
                data-height={assembled.payload.theme['size.height']?.type === 'dimension'
                    ? assembled.payload.theme['size.height'].value
                    : ''}
                data-shape={assembled.payload.theme['shape.button']?.type === 'shape'
                    ? assembled.payload.theme['shape.button'].cornerRadii[0]
                    : ''}
                data-pressed={
                    assembled.payload.component.properties.backgroundColor.states?.pressed?.type === 'tokenRef'
                        ? assembled.payload.component.properties.backgroundColor.states.pressed.tokenId
                        : ''
                }
                data-variation={assembled.payload.component.variations.customAxis}
                data-label={String(assembled.payload.example.props.label)}
                data-loading={String(assembled.payload.example.props.loading)}
                data-enabled={String(assembled.payload.example.props.enabled)}
                data-value={String(assembled.payload.example.props.value)}
                data-icon={String(assembled.payload.example.props.icon)}
                data-spacing={String(assembled.payload.example.props.spacing)}
                data-fixed-width={String(assembled.payload.example.props.hasFixedWidth)}
            />
            <ComposePreviewFrame
                pluginUrl={pluginUrl}
                payload={assembled.payload}
                onDescription={onDescription}
            />
        </main>
    );
};

createRoot(document.getElementById('root')!).render(<SmokeApp />);
