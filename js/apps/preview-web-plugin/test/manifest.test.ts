import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PREVIEW_MESSAGE_TYPES } from '../src/protocol';
import { registry } from '../src/registry';

// Компоненты `componentMapper` клиента (`js/apps/client/src/hooks/useStory.ts`) в том же порядке.
const CLIENT_COMPONENT_MAPPER = [
    'IconButton', 'Link', 'Button', 'Checkbox', 'Radiobox', 'Counter', 'Indicator', 'Badge', 'Spinner', 'Chip', 'Switch',
    'Skeleton', 'List', 'LinkButton', 'EmbedIconButton', 'Cell', 'Divider', 'EmptyState', 'Accordion', 'Slider', 'Note',
    'TextField', 'Range', 'TextArea', 'Tabs', 'TabItem', 'IconTabItem', 'ButtonGroup', 'Breadcrumbs', 'ChipGroup', 'Card',
    'Popover', 'TextFieldGroup', 'Avatar', 'Pagination', 'Progress', 'Sheet', 'Loader', 'ProgressBarCircular', 'NumberInput',
    'Rating', 'Image', 'AvatarGroup', 'Price', 'Tooltip', 'Modal', 'Popup', 'Dropzone', 'Select', 'Combobox', 'Dropdown',
    'Toolbar', 'Drawer', 'Toast', 'Notification', 'Steps', 'StepItem', 'Body', 'Dspl', 'Heading', 'Text', 'SegmentGroup',
    'SegmentItem',
];

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/preview-plugin.json'), 'utf8'));

describe('preview-plugin.json', () => {
    it('объявляет платформу web, протокол v1, точку входа и сообщения sdds.preview.*', () => {
        expect(manifest).toMatchObject({
            schemaVersion: 1,
            platform: 'web',
            protocolVersion: 1,
            entrypoint: 'index.html',
            payloadBridge: {
                readyMessageType: PREVIEW_MESSAGE_TYPES.ready,
                payloadMessageType: PREVIEW_MESSAGE_TYPES.payload,
                resultMessageType: PREVIEW_MESSAGE_TYPES.result,
                describeMessageType: PREVIEW_MESSAGE_TYPES.describe,
                descriptionMessageType: PREVIEW_MESSAGE_TYPES.description,
            },
        });
    });

    it('сверяет мету с архивом: хеш api-meta.json и версию библиотеки', () => {
        // То же, что бэкенд проверяет при публикации плагина: мета и рендер из одного релиза plasma-new-hope.
        const meta = readFileSync(resolve(process.cwd(), 'public/api-meta.json'));
        const installed = JSON.parse(
            readFileSync(resolve(process.cwd(), 'node_modules/@salutejs/plasma-new-hope/package.json'), 'utf8'),
        );
        expect(manifest.apiMetaSha256).toBe(createHash('sha256').update(meta).digest('hex'));
        expect(manifest.plasmaNewHopeVersion).toBe(installed.version);
        const components = JSON.parse(meta.toString('utf8')).map((entry: { componentName: string }) => entry.componentName);
        expect(components).toEqual(expect.arrayContaining(manifest.components));
    });

    it('перечисляет ровно компоненты реестра — все компоненты componentMapper клиента', () => {
        expect(manifest.components).toEqual(Object.keys(registry));
        expect(Object.keys(registry)).toEqual(CLIENT_COMPONENT_MAPPER);
    });

    it('все компоненты реестра есть в api-meta.json', () => {
        const meta = JSON.parse(readFileSync(resolve(process.cwd(), 'public/api-meta.json'), 'utf8'));
        const metaComponents = new Set(meta.map((entry: { componentName: string }) => entry.componentName));
        expect(Object.keys(registry).filter((name) => !metaComponents.has(name))).toEqual([]);
    });
});
