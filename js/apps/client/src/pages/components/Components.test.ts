import { describe, expect, it } from 'vitest';

import { componentNavigationTarget } from './Components';

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
