import { expect, it } from 'vitest';
import { Config } from '../../controllers/componentBuilder/config';
import { keepLoadedComponents } from './keepLoadedComponents';

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
