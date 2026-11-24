import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
    adjustedRadius,
    applyTemplate,
    basePropertyParams,
    colorVariableName,
    composeOf,
    coreConfigExportName,
    coreTokensExportName,
    pxToRem,
    STATE_PARAM_SUFFIX,
    toComponentName,
    typographyPartFor,
    typographyVariableBase,
    webAdapter,
} from './index.ts';

describe('web-mapping', () => {
    it('applyTemplate подставляет значения и оставляет номер без значения', () => {
        assert.equal(applyTemplate('0 $1 -0.125rem', ['1rem']), '0 1rem -0.125rem');
        assert.equal(applyTemplate('$1 $2', ['a']), 'a $2');
        assert.equal(applyTemplate('$0 $01', ['a']), '$0 a');
    });

    it('basePropertyParams берёт параметры свойства без состояния', () => {
        const component = {
            componentName: 'Button',
            params: [
                { paramName: 'buttonColor', type: 'color', id: 'color' },
                { paramName: 'buttonColorHover', type: 'color', id: 'color', state: 'hovered' },
                { paramName: 'buttonHeight', type: 'dimension', id: 'height' },
            ],
        };
        assert.deepEqual(basePropertyParams(component, 'color').map((param) => param.paramName), ['buttonColor']);
        assert.deepEqual(basePropertyParams(undefined, 'color'), []);
        assert.equal(STATE_PARAM_SUFFIX.hovered, 'Hover');
        assert.equal(STATE_PARAM_SUFFIX.pressed, 'Active');
    });

    it('composeOf возвращает дочерние компоненты в порядке адаптера', () => {
        const tabs = webAdapter.find((entry) => entry.componentName === 'tabs');
        assert.deepEqual(composeOf(tabs, webAdapter), [
            { id: 'icon-tab-item', name: 'IconTabItem' },
            { id: 'tab-item', name: 'TabItem' },
        ]);
        assert.deepEqual(composeOf({ componentName: 'x', name: 'X', compose: ['new-thing'] }, []), [
            { id: 'new-thing', name: 'NewThing' },
        ]);
        assert.equal(toComponentName('icon-tab-item'), 'IconTabItem');
    });

    it('единицы: px в rem и радиус с поправкой', () => {
        assert.equal(pxToRem(48), '3rem');
        assert.equal(adjustedRadius('var(--border-radius-m)', -2), 'calc(var(--border-radius-m) + -0.125rem)');
    });

    it('typographyPartFor: part меты или поле в имени параметра', () => {
        assert.equal(typographyPartFor('buttonFontSize'), 'fontSize');
        assert.equal(typographyPartFor('typoFontLetterSpacing'), 'letterSpacing');
        assert.equal(typographyPartFor('whatever', 'lineHeight'), 'lineHeight');
        assert.equal(typographyPartFor('buttonHeight'), undefined);
    });

    it('typographyVariableBase повторяет имена plasma-typo', () => {
        assert.equal(typographyVariableBase('header.h3.bold'), 'h3-bold');
        assert.equal(typographyVariableBase('header.h1.normal'), 'h1');
        assert.equal(typographyVariableBase('display.l.bold'), 'dspl-l-bold');
        assert.equal(typographyVariableBase('display.l.normal'), 'dspl-l');
        assert.equal(typographyVariableBase('text.m.medium'), 'text-m-medium');
        assert.equal(typographyVariableBase('body.s'), 'body-s');
        assert.equal(typographyVariableBase('constructor.m.bold'), 'constructor-m-bold');
        assert.equal(typographyVariableBase('header.h3.semibold'), 'h3-semibold');
        assert.equal(typographyVariableBase('text.m.toString'), 'text-m-toString');
    });

    it('colorVariableName: default опускается', () => {
        assert.equal(colorVariableName('text', 'default', 'primary'), '--text-primary');
        assert.equal(colorVariableName('surface', 'on-dark', 'solid-default'), '--on-dark-surface-solid-default');
    });

    it('имена экспортов ядра по манифесту или по умолчанию', () => {
        assert.equal(coreTokensExportName('TabItem', { coreTokensExport: 'tabsTokens' }), 'tabsTokens');
        assert.equal(coreTokensExportName('Button'), 'buttonTokens');
        assert.equal(coreConfigExportName('Skeleton', { coreConfigExport: 'lineSkeletonConfig' }), 'lineSkeletonConfig');
        assert.equal(coreConfigExportName('IconButton', {}), 'iconButtonConfig');
    });

    it('модуль не импортирует Node.js, ядро и код вне себя', () => {
        const directory = import.meta.dirname;
        for (const file of readdirSync(directory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))) {
            const source = readFileSync(join(directory, file), 'utf8');
            const specifiers = [
                ...source.matchAll(/(?:import|export)[^'";]*?from\s+['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g),
            ].map((match) => match[1] ?? match[2]);
            for (const specifier of specifiers) {
                const allowed = specifier.startsWith('./') || specifier === '../data/web-adapter.json';
                assert.ok(allowed, `${file} импортирует ${specifier}`);
            }
            assert.doesNotMatch(source, /\bprocess\.|\bBuffer\b|require\(/, `${file} использует Node.js`);
        }
    });
});
