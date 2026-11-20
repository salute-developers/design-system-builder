import { describe, expect, it } from 'vitest';
import { Config } from '../../controllers/componentBuilder/config';
import { buttonMeta } from '../../composePreview/nestedStyleFixture';
import { keepLoadedComponents, keepUnchangedComponents } from './keepLoadedComponents';

const component = (name: string, platform: 'web' | 'compose' = 'web') =>
    new Config({ name, platform, description: '', sources: { api: [], configs: [], variations: [] } });

it('оставляет загруженные экземпляры, добавляет новые и убирает пропавшие из индекса', () => {
    const loaded = component('A');
    const hidden = component('B');
    const fromIndex = component('A');
    const added = component('C');

    const result = keepLoadedComponents([loaded, hidden], [fromIndex, added]);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(loaded);
    expect(result[1]).toBe(added);
});

it('не путает компоненты разных платформ', () => {
    const web = component('A');
    const compose = component('A', 'compose');

    expect(keepLoadedComponents([web], [compose])).toEqual([compose]);
    expect(keepLoadedComponents(null, [web])[0]).toBe(web);
});

describe('keepUnchangedComponents', () => {
    const configured = () => new Config(structuredClone(buttonMeta()));

    it('оставляет тот же объект, если содержимое компонента не изменилось', () => {
        const current = configured();

        expect(keepUnchangedComponents([current], [configured()])[0]).toBe(current);
    });

    it('берёт новый экземпляр, если содержимое изменилось', () => {
        const current = configured();
        const next = new Config(structuredClone(buttonMeta()));
        const id = next.getMeta().invariantProps[0]?.id ?? next.getMeta().variations[0]?.styles?.[0]?.props?.[0]?.id;
        // Изменение значения на сервере: тот же компонент, другое содержимое.
        const changed = structuredClone(buttonMeta());
        changed.sources.configs[0].config.variations[0].styles![0].props = [{ id: id ?? 'x', value: 'other' }];

        const result = keepUnchangedComponents([current], [new Config(changed)]);

        expect(result[0]).not.toBe(current);
    });

    it('заменяет незагруженную заготовку компонента загруженным экземпляром', () => {
        const stub = new Config({
            ...structuredClone(buttonMeta()),
            sources: { api: [], configs: [], variations: [] },
        });
        const loaded = configured();

        expect(keepUnchangedComponents([stub], [loaded])[0]).toBe(loaded);
    });

    it('не путает компоненты разных платформ и добавляет новые', () => {
        const web = new Config({ ...structuredClone(buttonMeta()), platform: 'web' });
        const compose = new Config({ ...structuredClone(buttonMeta()), platform: 'compose' });

        expect(keepUnchangedComponents([web], [compose])[0]).toBe(compose);
        expect(keepUnchangedComponents(null, [web])[0]).toBe(web);
    });
});
