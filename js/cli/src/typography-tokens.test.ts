import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTypographyTokens } from './generator/themeBuilder/creators/createTypographyTokens.ts';
import type { TokenType } from './generator/themeBuilder/types/index.ts';

const token = (name: string): TokenType =>
    ({
        type: 'typography',
        name,
        tags: name.split('.'),
        displayName: name,
        description: name,
        enabled: true,
    }) as TokenType;

const value = (family: string) => ({
    fontFamilyRef: `fontFamily.${family}`,
    fontSize: '1rem',
    fontWeight: '400',
    lineHeight: '1.25rem',
    letterSpacing: 'normal',
    fontStyle: 'normal',
});

describe('createTypographyTokens', () => {
    it('выпускает свои группы и стили с произвольным именем рядом с системными', () => {
        const names = ['screen-s.body.m.normal', 'screen-s.header.h1.bold', 'screen-s.caption.promo-title.medium'];
        const typography = {
            'screen-s.body.m.normal': value('body'),
            'screen-s.header.h1.bold': value('header'),
            'screen-s.caption.promo-title.medium': value('caption'),
        };
        const fontFamily = {
            body: { name: 'SB Sans Text' },
            header: { name: 'SB Sans Display' },
            caption: { name: 'SB Sans Caption' },
        };

        const { light } = createTypographyTokens(typography, fontFamily, names.map(token));

        assert.match(light.root, /--plasma-typo-caption-font-family: 'SB Sans Caption', sans-serif;/);
        assert.match(
            light.root,
            /--plasma-typo-caption-promo-title-medium-font-family: var\(--plasma-typo-caption-font-family\);/,
        );
        assert.match(light.root, /--plasma-typo-body-m-font-family: var\(--plasma-typo-body-font-family\);/);
        assert.match(light.screenS, /--plasma-typo-h1-bold-font-size: 1rem;/);
        assert.match(light.screenS, /--plasma-typo-caption-promo-title-medium-font-size: 1rem;/);
    });
});
