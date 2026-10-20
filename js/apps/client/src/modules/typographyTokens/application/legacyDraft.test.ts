import { describe, expect, it } from 'vitest';

import { typographyStyles } from '../testFixtures';
import { legacyTypographyChanges } from './legacyDraft';

const web = (fontSize: string, fontWeight: string) => ({
    web: {
        fontSize,
        lineHeight: '1.5rem',
        letterSpacing: 'normal',
        fontWeight,
        fontStyle: 'normal',
        fontFamilyRef: 'fontFamily.display',
    },
});

describe('перенос типографии из прежнего черновика', () => {
    it('собирает правку стиля экрана из записей начертаний через значения веба', () => {
        const changes = legacyTypographyChanges(
            [
                { name: 'screen-l.body.m.bold', values: web('1.25rem', '700') },
                { name: 'screen-l.body.m.normal', values: web('1.125rem', '400') },
                { name: 'screen-s.body.m.medium', values: web('0.875rem', '500') },
                { name: 'screen-l.unknown.x.normal', values: web('1rem', '400') },
                { name: 'body.m.normal', values: web('1rem', '400') },
            ],
            typographyStyles(),
        );
        expect(changes).toEqual([
            {
                key: 'screen-l|body.m',
                tokenId: 'screen-l.body.m.normal',
                change: {
                    size: 18,
                    lineHeight: 24,
                    letterSpacing: 0,
                    weights: { normal: 400, bold: 700 },
                    fontFamily: 'display',
                },
                names: ['screen-l.body.m.bold', 'screen-l.body.m.normal'],
            },
            {
                key: 'screen-s|body.m',
                tokenId: 'screen-s.body.m.normal',
                change: { size: 14, lineHeight: 24, letterSpacing: 0, weights: { medium: 500 }, fontFamily: 'display' },
                names: ['screen-s.body.m.medium'],
            },
        ]);
    });
});
