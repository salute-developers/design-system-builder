import { expect, it, vi } from 'vitest';

const responses: Record<string, unknown[]> = {
    '/components': [{ id: 'component', name: 'Accordion' }],
    '/appearances': [{ id: 'appearance', name: 'Accordion', componentId: 'component' }],
    '/properties': [{ id: 'property', name: 'accordionGap', componentId: 'component' }],
    '/variations': [{ id: 'variation', name: 'size', componentId: 'component' }],
    '/styles': [{ id: 'style', name: 'm', variationId: 'variation', designSystemId: 'ds' }],
    '/states': [
        { id: 'hovered', name: 'hovered' },
        { id: 'pressed', name: 'pressed' },
    ],
    '/state-sets': [
        { id: 'base', stateIds: [] },
        { id: 'hover-press', stateIds: ['hovered', 'pressed'] },
    ],
};

vi.mock('./editorReads', () => ({
    readEditor: vi.fn(async (url: string) => {
        const key = Object.keys(responses)
            .sort((a, b) => b.length - a.length)
            .find((suffix) => url.endsWith(suffix));
        return { data: key ? responses[key] : [] };
    }),
}));

import { loadJournalComponentMetadata } from './journalComponentMetadata';

it('отдаёт вариацию стиля и имена состояний наборов', async () => {
    const metadata = await loadJournalComponentMetadata({
        projectId: 'project',
        designSystemId: 'ds',
        tenantId: 'tenant',
    });

    expect(metadata.referenceNames).toMatchObject({ property: 'accordionGap', style: 'm', variation: 'size' });
    expect(metadata.styleVariations).toEqual({ style: 'size' });
    expect(metadata.stateSetStates).toEqual({ base: [], 'hover-press': ['hovered', 'pressed'] });
    expect(metadata.componentNames).toMatchObject({ style: 'Accordion', property: 'Accordion' });
});
