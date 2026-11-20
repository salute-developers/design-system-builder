import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TokenValuesApi } from './token-values.api.ts';
import { PaletteApi, paletteLinkedValues, type ThemePalette } from './palette.api.ts';
import type { Session } from './authentication.ts';
import type { TokenValue } from './token-values.api.ts';

const session = { accessToken: 'unit-test-token' } as Session;

test('TokenValuesApi compares complete rows independently of response order', async (context) => {
    const row = { tokenId: 'a', tenantId: 'theme', platform: 'web', mode: 'light', value: '#ffffff', editRevision: 2 };
    const rows = [
        row,
        { ...row, tokenId: 'b', mode: null },
        { ...row, mode: 'dark' },
        { ...row, platform: 'ios' },
        row,
    ];
    let body = rows;
    context.mock.method(globalThis, 'fetch', async () => Response.json(body));
    const api = new TokenValuesApi('http://localhost/', 'project', 'system', session);
    const before = await api.values('theme', 'color');
    body = [...rows].reverse();
    assert.deepEqual(await api.values('theme', 'color'), before);
    assert.equal(before.length, rows.length, 'Duplicates must not be discarded');
    body = rows.map((item) => (item.tokenId === 'b' ? { ...item, editRevision: 3 } : item));
    assert.notDeepEqual(await api.values('theme', 'color'), before, 'Revision changes remain visible');
    body = rows.map((item) => (item.tokenId === 'b' ? { ...item, value: '#000000' } : item));
    assert.notDeepEqual(await api.values('theme', 'color'), before, 'Value changes remain visible');
});

test('PaletteApi normalizes only the token catalog and retains all token fields', async (context) => {
    const token = { tokenId: 'a', tokenName: 'text.primary', groupId: 'group', assignment: 'default' };
    const tokens = [token, { ...token, tokenId: 'b', tokenName: 'text.secondary' }, token];
    const palette = {
        tenantId: 'theme',
        editRevision: 2,
        groups: [{ id: 'group', ramps: [{ steps: [{ step: 900 }, { step: 100 }] }] }],
        template: [{ shade: 'h130', steps: [{ step: 900 }, { step: 100 }] }],
        tokens,
    };
    let body = palette;
    context.mock.method(globalThis, 'fetch', async () => Response.json(body));
    const api = new PaletteApi('http://localhost/', 'project', 'system', 'theme', session);
    const before = await api.get();
    body = { ...palette, tokens: [tokens[1]!, tokens[0]!, tokens[2]!] };
    assert.deepEqual(await api.get(), before);
    assert.equal(before.tokens.length, tokens.length);
    assert.deepEqual(before.groups, palette.groups, 'Ramp and step order remains significant');
    assert.deepEqual(before.template, palette.template);
    body = { ...palette, tokens: tokens.map((item) => ({ ...item, groupId: 'other' })) };
    assert.notDeepEqual(await api.get(), before, 'Group changes remain visible');
    body = { ...palette, tokens: tokens.map((item) => ({ ...item, tokenName: 'renamed' })) };
    assert.notDeepEqual(await api.get(), before, 'Name changes remain visible');
});

test('Palette dependencies include extra references in the target group and exclude other groups', () => {
    const token = { tokenId: 'prepared', tokenName: 'text.primary', groupId: 'accent', assignment: 'default' };
    const palette: ThemePalette = {
        tenantId: 'theme',
        editRevision: 0,
        groups: [],
        template: [],
        tokens: [token, { ...token, tokenId: 'extra' }, { ...token, tokenId: 'foreign', groupId: 'status' }],
    };
    const row: TokenValue = {
        tokenId: 'prepared',
        tenantId: 'theme',
        platform: 'web',
        mode: 'light',
        value: ['#123456'],
        editRevision: 2,
        paletteRef: '[additional.h130.500]',
    };
    const extra = { ...row, tokenId: 'extra' };
    const extraIOS: TokenValue = { ...extra, platform: 'ios', mode: 'dark' };
    const foreign = { ...row, tokenId: 'foreign' };
    const values = [row, foreign, extra, extraIOS, { ...row, paletteRef: '[additional.h200.500]' }];
    assert.deepEqual(paletteLinkedValues(palette, values, 'accent', '[additional.h130.500]'), [row, extra, extraIOS]);
    assert.deepEqual(paletteLinkedValues(palette, values, 'status', '[additional.h130.500]'), [foreign]);
});
