import { describe, expect, it } from 'vitest';

import { componentNavigationTarget, platformSwitchItems } from './Components';

describe('componentNavigationTarget', () => {
    it('сохраняет выбранную опубликованную версию при переходе между компонентами', () => {
        expect(componentNavigationTarget('../components/Button', '?versionId=published-version')).toEqual({
            pathname: '../components/Button',
            search: '?versionId=published-version',
        });
    });

    it('не добавляет параметры для активного черновика', () => {
        expect(componentNavigationTarget('../colors', '')).toEqual({
            pathname: '../colors',
            search: '',
        });
    });
});

describe('platformSwitchItems', () => {
    it('показывает обе платформы и отключает ту, у которой нет компонентов', () => {
        expect(platformSwitchItems(['compose'])).toEqual([
            { label: 'Web', value: 'web', disabled: true },
            { label: 'Compose', value: 'compose', disabled: false },
        ]);
        expect(platformSwitchItems(['web'])).toEqual([
            { label: 'Web', value: 'web', disabled: false },
            { label: 'Compose', value: 'compose', disabled: true },
        ]);
    });

    it('не отключает ничего, когда есть обе платформы, и держит Web первым', () => {
        expect(platformSwitchItems(['compose', 'web']).map(({ value, disabled }) => [value, disabled])).toEqual([
            ['web', false],
            ['compose', false],
        ]);
    });
});
