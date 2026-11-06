import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createShadowTokens } from './generator/themeBuilder/creators/createShadowTokens.ts';
import type { TokenType } from './generator/themeBuilder/types/index.ts';

const token = (name: string): TokenType =>
    ({ type: 'shadow', name, tags: name.split('.'), displayName: name, description: name, enabled: true }) as TokenType;

describe('createShadowTokens', () => {
    it('выпускает все тени, а не только down и up: сначала down, затем up, затем остальные', () => {
        const tokens = ['card', 'up.soft.s', 'down.soft.s', 'elevated.focus'].map(token);
        const values = {
            card: ['0 2px 4px #000'],
            'up.soft.s': ['0 -2px 4px #000'],
            'down.soft.s': ['0 2px 8px #000'],
            'elevated.focus': ['0 0 0 2px #2b8ced'],
        };

        const { light } = createShadowTokens(values, tokens);

        assert.deepEqual(
            light.split('\n').map((line) => line.trim().split(':')[0]),
            ['--shadow-down-soft-s', '--shadow-up-soft-s', '--shadow-card', '--shadow-elevated-focus'],
        );
    });

    it('JS-вывод содержит все тени, а имена с одной переменной прерывают генерацию', () => {
        const tokens = ['constructor', 'up.soft.s', 'card'].map(token);
        const values = { constructor: ['0 1px #000'], 'up.soft.s': ['0 -2px #000'], card: ['0 2px #000'] };

        const { light } = createShadowTokens(values, tokens, true);
        assert.deepEqual(
            [...light.matchAll(/export const (\w+)/g)].map((match) => match[1]),
            ['shadowUpSoftS', 'shadowConstructor', 'shadowCard'],
        );

        assert.throws(
            () => createShadowTokens({}, ['down.soft.m', 'down-soft-m'].map(token)),
            /down\.soft\.m и down-soft-m/,
        );
    });
});
