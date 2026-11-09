import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ts from 'typescript';

import { appearanceConfigFile, appearanceIdentifier } from './generator/utils/appearanceName.ts';

process.env.NPM_PACKAGE_SCOPE ??= '@test-scope';
const { createConditionalComponent } = await import('./generator/creators/createComponent.ts');

const syntaxErrors = (source: string) => {
    const file = ts.createSourceFile('Accordion.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return (file as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics.map((item) =>
        ts.flattenDiagnosticMessageText(item.messageText, '\n'),
    );
};

describe('имена конфигураций в web-генерации', () => {
    it('строит camelCase-идентификаторы и файлы из kebab-case, значение appearance оставляет как в данных', () => {
        const source = createConditionalComponent('Accordion', 'Аккордеон', ['default', 'clear-action'], 'accordionConfig');

        assert.deepEqual(syntaxErrors(source), []);
        assert.match(source, /import \{ config as clearActionConfig \} from '\.\/Accordion\.clearAction\.config';/);
        assert.match(source, /import \{ config as defaultConfig \} from '\.\/Accordion\.config';/);
        assert.match(source, /export const AccordionClearAction = component\(mergedClearActionConfig\);/);
        assert.match(source, /    'clear-action': AccordionClearAction,/);
        assert.match(source, /    default: AccordionDefault,/);
        assert.equal(appearanceConfigFile('Accordion', 'clear-action'), 'Accordion.clearAction.config');
    });

    it('останавливает генерацию на имени не в kebab-case', () => {
        assert.throws(() => appearanceIdentifier('Accordion', 'Accordion new'), /Accordion.*«Accordion new»/);
        assert.throws(
            () => createConditionalComponent('Accordion', '', ['default', 'Accordion new'], 'accordionConfig'),
            /kebab-case/,
        );
    });
});
