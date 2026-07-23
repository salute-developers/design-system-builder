import { PreviewPayload } from './types';

/**
 * Versioned integration fixture aligned with preview-compose-plugin's canonical
 * Preview Protocol v1 BasicButton fixture. It deliberately does not depend on
 * Config, Theme, variations, or backend entities.
 */
export const BASIC_BUTTON_PREVIEW_FIXTURE: PreviewPayload = {
    protocolVersion: 1,
    platform: 'COMPOSE',
    assets: [],
    theme: {
        'color.background': { type: 'color', value: '#2A72E5FF' },
        'color.background.pressed': { type: 'color', value: '#1959B8FF' },
        'color.content': { type: 'color', value: '#FFFFFFFF' },
        'size.height': { type: 'dimension', value: 48 },
        'size.padding': { type: 'dimension', value: 20 },
        'size.icon': { type: 'dimension', value: 24 },
        'shape.button': { type: 'shape', cornerRadii: [12, 12, 12, 12] },
        'font.body': {
            type: 'fontFamily',
            faces: [],
            allowFallback: true,
        },
        'typography.button': {
            type: 'typography',
            fontFamilyTokenId: 'font.body',
            fontSize: 16,
            lineHeight: 20,
            letterSpacing: 0,
            weight: 400,
        },
    },
    component: {
        id: 'BasicButton',
        variations: { size: 'l', view: 'primary' },
        properties: {
            shape: { base: { type: 'tokenRef', tokenId: 'shape.button' } },
            labelStyle: { base: { type: 'tokenRef', tokenId: 'typography.button' } },
            contentColor: { base: { type: 'tokenRef', tokenId: 'color.content' } },
            backgroundColor: {
                base: { type: 'tokenRef', tokenId: 'color.background' },
                states: {
                    pressed: { type: 'tokenRef', tokenId: 'color.background.pressed' },
                },
            },
            height: { base: { type: 'tokenRef', tokenId: 'size.height' } },
            paddingStart: { base: { type: 'tokenRef', tokenId: 'size.padding' } },
            paddingEnd: { base: { type: 'tokenRef', tokenId: 'size.padding' } },
            iconSize: { base: { type: 'tokenRef', tokenId: 'size.icon' } },
            disableAlpha: { base: { type: 'literal', value: 0.4 } },
            loadingAlpha: { base: { type: 'literal', value: 0.6 } },
        },
    },
    example: {
        id: 'BasicButton',
        props: {
            label: 'Canonical button',
            value: 'Value',
            icon: 'No',
            spacing: 'Packed',
            hasFixedWidth: true,
            enabled: true,
            loading: false,
        },
    },
    surface: { width: 360, height: 160, background: '#FFFFFFFF' },
};

export const createBasicButtonPreviewPayload = (
    args: Record<string, string | boolean>,
): PreviewPayload => {
    const example = BASIC_BUTTON_PREVIEW_FIXTURE.example as Record<string, JsonCompatible>;
    const props = example.props as Record<string, JsonCompatible>;

    return {
        ...BASIC_BUTTON_PREVIEW_FIXTURE,
        example: {
            ...example,
            props: {
                ...props,
                ...(typeof args.text === 'string' ? { label: args.text } : {}),
                ...(typeof args.disabled === 'boolean' ? { enabled: !args.disabled } : {}),
                ...(typeof args.loading === 'boolean' ? { loading: args.loading } : {}),
            },
        },
    };
};

type JsonCompatible = null | boolean | number | string | JsonCompatible[] | { [key: string]: JsonCompatible };
