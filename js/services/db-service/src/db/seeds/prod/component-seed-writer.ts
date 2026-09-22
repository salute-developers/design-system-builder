import fs from 'fs';
import path from 'path';
import type { AdjustSeed, AppearanceSeed, CombinationSeed, ComponentSeed, ValueSeed } from './component-seed';

/**
 * Запись сида компонента в папку `components/<имя>/`: properties.ts, variations.ts, index.ts и
 * файл значений на каждый appearance (`values.ts` у единственного `default`, иначе `values.<имя>.ts`).
 * Один формат для выгрузки из базы (`seed-generate-prod.ts`) и импорта из plasma (`import-plasma-component.ts`).
 */

/** Строковый литерал в одинарных кавычках. */
const str = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
/** Ключ объекта: без кавычек, если это идентификатор. */
const key = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : str(name));
const header = `import type`;

const adjustLiteral = (rows: AdjustSeed[]) =>
    `[${rows
        .map((a) => {
            const parts = [`platform: ${str(a.platform)}`, `param: ${str(a.param)}`];
            if (a.value !== undefined) parts.push(`value: ${str(a.value)}`);
            if (a.template !== undefined) parts.push(`template: ${str(a.template)}`);
            return `{ ${parts.join(', ')} }`;
        })
        .join(', ')}]`;

const valueParts = (value: ValueSeed) => {
    const parts = [`prop: ${str(value.prop)}`];
    if (value.token !== undefined) parts.push(`token: ${str(value.token)}`);
    if (value.value !== undefined) parts.push(`value: ${str(value.value)}`);
    const states = value.state === undefined ? [] : [value.state].flat();
    if (states.length === 1) parts.push(`state: ${str(states[0])}`);
    if (states.length > 1) parts.push(`state: [${states.map(str).join(', ')}]`);
    if (value.adjust?.length) parts.push(`adjust: ${adjustLiteral(value.adjust)}`);
    return parts;
};

const combinationLine = (combo: CombinationSeed) => {
    const styles = `styles: { ${Object.entries(combo.styles)
        .map(([variation, style]) => `${key(variation)}: ${str(style)}`)
        .join(', ')} }`;
    const [prop, ...rest] = valueParts(combo);
    return `    { ${[prop, styles, ...rest].join(', ')} },`;
};

/** Файл значений appearance: `values`, при наличии `invariants` и `combinations`. */
const renderValuesFile = (appearance: AppearanceSeed) => {
    const valueBlocks: string[] = [];
    for (const [variation, byStyle] of Object.entries(appearance.values)) {
        const styleBlocks = Object.entries(byStyle)
            .filter(([, list]) => list.length)
            .map(([style, list]) => {
                const lines = list.map((value) => `            { ${valueParts(value).join(', ')} },`);
                return `        ${key(style)}: [\n${lines.join('\n')}\n        ],`;
            });
        if (styleBlocks.length) valueBlocks.push(`    ${key(variation)}: {\n${styleBlocks.join('\n')}\n    },`);
    }
    const invariantLines = (appearance.invariants ?? []).map((value) => `    { ${valueParts(value).join(', ')} },`);
    const combinationLines = (appearance.combinations ?? []).map(combinationLine);

    const types = ['ValuesSeed'];
    if (invariantLines.length) types.push('ValueSeed');
    if (combinationLines.length) types.push('CombinationSeed');
    const file = [
        `${header} { ${types.sort().join(', ')} } from '../../component-seed';`,
        '',
        valueBlocks.length ? `export const values: ValuesSeed = {\n${valueBlocks.join('\n')}\n};` : `export const values: ValuesSeed = {};`,
    ];
    if (invariantLines.length) file.push('', `export const invariants: ValueSeed[] = [\n${invariantLines.join('\n')}\n];`);
    if (combinationLines.length) file.push('', `export const combinations: CombinationSeed[] = [\n${combinationLines.join('\n')}\n];`);

    const exported = ['values', ...(invariantLines.length ? ['invariants'] : []), ...(combinationLines.length ? ['combinations'] : [])];
    return { content: `${file.join('\n')}\n`, exported };
};

/** Содержимое файлов папки компонента: имя файла -> текст. */
export function renderComponentSeed(seed: ComponentSeed): Record<string, string> {
    const propertyLines = seed.properties.map((p) => {
        const parts = [`name: ${str(p.name)}`, `type: ${str(p.type)}`];
        if (p.description) parts.push(`description: ${str(p.description)}`);
        if (p.defaultValue) parts.push(`defaultValue: ${str(p.defaultValue)}`);
        if (p.variations?.length) parts.push(`variations: [${p.variations.map(str).join(', ')}]`);
        const params = Object.entries(p.params ?? {}).filter(([, names]) => names?.length);
        if (params.length) {
            parts.push(`params: { ${params.map(([platform, names]) => `${platform}: [${names!.map(str).join(', ')}]`).join(', ')} }`);
        }
        return `    { ${parts.join(', ')} },`;
    });

    const variationBlocks = seed.variations.map((v) => {
        const lines = [`        name: ${str(v.name)},`];
        if (v.description) lines.push(`        description: ${str(v.description)},`);
        lines.push(`        styles: [`);
        for (const s of v.styles) {
            const parts = [`name: ${str(s.name)}`];
            if (s.description) parts.push(`description: ${str(s.description)}`);
            lines.push(`            { ${parts.join(', ')} },`);
        }
        lines.push(`        ],`);
        return `    {\n${lines.join('\n')}\n    },`;
    });

    const list = (lines: string[]) => (lines.length ? `[\n${lines.join('\n')}\n]` : '[]');
    const files: Record<string, string> = {
        'properties.ts': `${header} { PropertySeed } from '../../component-seed';\n\nexport const properties: PropertySeed[] = ${list(propertyLines)};\n`,
        'variations.ts': `${header} { VariationSeed } from '../../component-seed';\n\nexport const variations: VariationSeed[] = ${list(variationBlocks)};\n`,
    };

    // Единственный appearance `default` держит значения в `values.ts`, несколько — в `values.<имя>.ts`.
    const single = seed.appearances.length === 1 && seed.appearances[0].name === 'default';
    const imports: string[] = [];
    const appearanceBlocks = seed.appearances.map((appearance) => {
        const { content, exported } = renderValuesFile(appearance);
        const fileName = single ? 'values' : `values.${appearance.name}`;
        files[`${fileName}.ts`] = content;
        const alias = single ? '' : key(appearance.name);
        imports.push(single ? `import { ${exported.join(', ')} } from './${fileName}';` : `import * as ${alias} from './${fileName}';`);

        const parts = [`name: ${str(appearance.name)}`];
        if (appearance.variations) parts.push(`variations: [${appearance.variations.map(str).join(', ')}]`);
        const defaults = Object.entries(appearance.defaults ?? {});
        if (defaults.length) parts.push(`defaults: { ${defaults.map(([v, s]) => `${key(v)}: ${str(s)}`).join(', ')} }`);
        parts.push(single ? exported.join(', ') : `...${alias}`);
        return `        { ${parts.join(', ')} },`;
    });

    files['index.ts'] = [
        `${header} { ComponentSeed } from '../../component-seed';`,
        `import { properties } from './properties';`,
        ...imports,
        `import { variations } from './variations';`,
        '',
        `export const seed: ComponentSeed = {`,
        `    name: ${str(seed.name)},`,
        ...(seed.description ? [`    description: ${str(seed.description)},`] : []),
        '    properties,',
        '    variations,',
        `    appearances: [\n${appearanceBlocks.join('\n')}\n    ],`,
        `};`,
        '',
    ].join('\n');

    return files;
}

/** Переписывает папку компонента целиком. */
export function writeComponentSeed(dir: string, seed: ComponentSeed) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(renderComponentSeed(seed))) {
        fs.writeFileSync(path.join(dir, file), content);
    }
}
