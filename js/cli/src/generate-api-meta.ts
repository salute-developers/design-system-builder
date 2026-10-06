import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const usage = `Usage:
  generate-api-meta --package <name> [--out <file> | --sdds <dir>]
  generate-api-meta --source <dir> [--out <file> | --sdds <dir>]

Builds api-meta.json from JSDoc annotations of token dictionaries.

  --package <name>  Installed package to read, resolved from node_modules of the current directory.
                    Its published types/**/*.tokens.d.ts keep the annotations.
  --source <dir>    Directory with *.tokens.ts or *.tokens.d.ts, e.g. component sources in a monorepo.
  --out <file>      Where to write the metadata. Default: <sdds>/web/web-api-meta.json, next to the web
                    data that components generation reads.
  --sdds <dir>      Local data directory for the default output (default: js/cli/.sdds).

The dictionary is the \`tokens\` export, or the only other export named *Tokens (e.g. treeTokens).
Internal dictionaries (privateTokens, innerTokens) are ignored. A token file without a dictionary
produces a component with empty params.

Annotations:

    /** @styleType color @styleProp buttonColor @styleState hovered */
    buttonColorHover: '--plasma-button-color-hover',

  @styleType <type>    Required. One of the Style API property types.
  @styleProp <id>      Common config property id. Defaults to the token key.
  @stylePart <part>    Part of a compound property (typography, component_style).
  @styleState <state>  State the token applies to.
  @styleComponent <A> [<B> ...]  Components the token belongs to. Defaults to the component of the file:
                       Button.tokens.ts → Button, Tabs/tokens.ts → Tabs.
  @deprecated {@link <token>}    Marks the token as deprecated in favour of another token.

Dictionaries without @styleType tags are not annotated yet and are skipped. Annotations are fully
validated when the components package is built; the generator only requires @styleType on every token
of an annotated dictionary and unique component names.`;

interface Options {
    source?: string;
    packageName?: string;
    out?: string;
    sdds?: string;
}

interface Source {
    directory: string;
    name: string;
    version: string;
}

interface Deprecation {
    message?: string;
}

interface Annotation {
    key: string;
    styleType?: string;
    styleProp?: string;
    stylePart?: string;
    styleState?: string;
    styleComponent?: string[];
    deprecated?: Deprecation;
}

interface Param {
    paramName: string;
    type: string;
    id: string;
    part?: string;
    state?: string;
    deprecated?: Deprecation;
}

interface ComponentMeta {
    componentName: string;
    params: Param[];
}

type DictionaryMember = ts.PropertyAssignment | ts.PropertySignature;

const tokenFileSuffixes = ['.tokens.d.ts', '.tokens.ts'];
// Some components keep tokens in a plain tokens.ts; the component is then named after the directory.
const plainTokenFiles = new Set(['tokens.d.ts', 'tokens.ts']);
// TODO: Beta components and the Tour card are not part of the Style API yet.
const ignoredDirectories = new Set(['_beta']);
const ignoredPaths = ['Tour/components/Card'];
const internalDictionaries = new Set(['privateTokens', 'innerTokens']);

function parseArgs(argv: string[]): Options {
    const options: Partial<Options> = {};
    const valueOptions: Record<string, keyof Options> = {
        '--source': 'source',
        '--package': 'packageName',
        '--out': 'out',
        '--sdds': 'sdds',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const key = valueOptions[argv[index]];
        const value = argv[index + 1];
        if (!key || !value || value.startsWith('--')) {
            throw new Error(`Style API meta: unexpected argument "${argv[index]}".\n\n${usage}`);
        }
        options[key] = value;
        index += 1;
    }
    if (Boolean(options.source) === Boolean(options.packageName)) {
        throw new Error(`Style API meta: pass either --source or --package.\n\n${usage}`);
    }
    if (options.out && options.sdds) {
        throw new Error(`Style API meta: pass either --out or --sdds.\n\n${usage}`);
    }

    return options;
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

async function readPackageJson(directory: string): Promise<{ name: string; version: string }> {
    return JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
}

/** Finds an installed package the way Node does: in node_modules of the directory or any of its parents. */
async function findInstalledPackage(name: string, from: string): Promise<string> {
    for (let directory = from; ; directory = dirname(directory)) {
        const candidate = join(directory, 'node_modules', name);
        if (await exists(join(candidate, 'package.json'))) {
            return candidate;
        }
        if (dirname(directory) === directory) {
            throw new Error(`Style API meta: package "${name}" is not installed in ${from}.`);
        }
    }
}

/** Finds the package that contains a source directory, to record where the metadata came from. */
async function findOwningPackage(from: string): Promise<string> {
    for (let directory = from; ; directory = dirname(directory)) {
        if (await exists(join(directory, 'package.json'))) {
            return directory;
        }
        if (dirname(directory) === directory) {
            throw new Error(`Style API meta: no package.json above ${from}.`);
        }
    }
}

async function resolveSource({ source, packageName }: Options): Promise<Source> {
    if (packageName) {
        const packageDirectory = await findInstalledPackage(packageName, process.cwd());
        const typesDirectory = join(packageDirectory, 'types');
        if (!(await exists(typesDirectory))) {
            throw new Error(`Style API meta: package "${packageName}" has no types directory.`);
        }
        const { name, version } = await readPackageJson(packageDirectory);
        return { directory: typesDirectory, name, version };
    }

    const directory = resolve(source!);
    const { name, version } = await readPackageJson(await findOwningPackage(directory));
    return { directory, name, version };
}

const tokenFileName = (file: string) => tokenFileSuffixes.find((suffix) => file.endsWith(suffix));
const isTokenFile = (name: string) => plainTokenFiles.has(name) || Boolean(tokenFileName(name));
/** Button.tokens.ts → Button, Skeleton/tokens.ts → Skeleton. */
const defaultComponent = (file: string) =>
    plainTokenFiles.has(basename(file)) ? basename(dirname(file)) : basename(file, tokenFileName(file));

const isIgnoredDirectory = (path: string, name: string) =>
    ignoredDirectories.has(name) || ignoredPaths.some((ignored) => path.split(sep).join('/').endsWith(`/${ignored}`));

async function findTokenFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry): Promise<string[]> => {
            const path = resolve(directory, entry.name);

            if (entry.isDirectory()) {
                return isIgnoredDirectory(path, entry.name) ? [] : findTokenFiles(path);
            }

            return entry.isFile() && isTokenFile(entry.name) ? [path] : [];
        }),
    );

    return nested.flat().sort();
}

const isDictionaryName = (name: string) => (name === 'tokens' || name.endsWith('Tokens')) && !internalDictionaries.has(name);

/**
 * Returns members of the exported token dictionary: object literal properties in sources,
 * or type literal members in declaration files (`export declare const tokens: { ... }`).
 * Returns undefined when the file has no dictionary.
 */
function findDictionaryMembers(sourceFile: ts.SourceFile, location: string): DictionaryMember[] | undefined {
    const dictionaries = new Map<string, DictionaryMember[]>();

    for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) {
            continue;
        }
        const isExported = statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword);
        if (!isExported) {
            continue;
        }
        for (const { name, initializer, type } of statement.declarationList.declarations) {
            if (!ts.isIdentifier(name) || !isDictionaryName(name.text)) {
                continue;
            }
            const literal = initializer && ts.isAsExpression(initializer) ? initializer.expression : initializer;
            if (literal && ts.isObjectLiteralExpression(literal)) {
                dictionaries.set(name.text, literal.properties.filter(ts.isPropertyAssignment));
            } else if (type && ts.isTypeLiteralNode(type)) {
                dictionaries.set(name.text, type.members.filter(ts.isPropertySignature));
            }
        }
    }

    if (dictionaries.has('tokens')) {
        return dictionaries.get('tokens');
    }
    if (dictionaries.size > 1) {
        throw new Error(
            `${location}: several token dictionaries (${[...dictionaries.keys()].join(', ')}), expected one.`,
        );
    }
    return [...dictionaries.values()][0];
}

function propertyKey(property: DictionaryMember, sourceFile: ts.SourceFile): string {
    const { name } = property;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
        return name.text;
    }
    throw new Error(`unsupported key "${name.getText(sourceFile)}"`);
}

const stringTags = ['styleType', 'styleProp', 'stylePart', 'styleState'] as const;
const isStringTag = (name: string): name is (typeof stringTags)[number] =>
    (stringTags as readonly string[]).includes(name);

/** Reads style tags of one dictionary property. */
function readAnnotation(property: DictionaryMember, key: string): Annotation {
    const annotation: Annotation = { key };

    for (const tag of ts.getJSDocTags(property)) {
        const name = tag.tagName.text;
        const text = ts.getTextOfJSDocComment(tag.comment)?.trim() ?? '';

        if (name === 'deprecated') {
            const replacement = text.match(/\{@link\s+([^\s|}]+)/)?.[1];
            annotation.deprecated = replacement ? { message: `Используйте вместо ${replacement}` } : {};
        } else if (name === 'styleComponent') {
            annotation.styleComponent = text.split(/\s+/).filter(Boolean);
        } else if (isStringTag(name)) {
            annotation[name] = text;
        }
    }

    return annotation;
}

const byName = (left: string, right: string) => left.localeCompare(right);

function toParam({ key, styleType, styleProp = key, stylePart, styleState, deprecated }: Annotation): Param {
    return {
        paramName: key,
        type: styleType!,
        id: styleProp,
        ...(stylePart ? { part: stylePart } : {}),
        ...(styleState ? { state: styleState } : {}),
        ...(deprecated ? { deprecated } : {}),
    };
}

const options = parseArgs(process.argv.slice(2));
const source = await resolveSource(options);
const components: ComponentMeta[] = [];
const fileByComponent = new Map<string, string>();
const duplicates = new Map<string, string[]>();
let skipped = 0;

for (const file of await findTokenFiles(source.directory)) {
    const location = relative(process.cwd(), file);
    const sourceFile = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const members = findDictionaryMembers(sourceFile, location) ?? [];
    const annotations = members.map((property) => {
        const key = propertyKey(property, sourceFile);
        return readAnnotation(property, key);
    });

    // A dictionary without a single annotation is not annotated yet; a file without tokens is still listed.
    if (annotations.length > 0 && !annotations.some(({ styleType }) => styleType)) {
        skipped += 1;
        continue;
    }

    const unannotated = annotations.filter(({ styleType }) => !styleType).map(({ key }) => key);
    if (unannotated.length > 0) {
        throw new Error(`${location}: tokens without @styleType: ${unannotated.join(', ')}.`);
    }

    // A token belongs to the components from @styleComponent, otherwise to the component of the file.
    const fallback = defaultComponent(file);
    const paramsByComponent = new Map<string, Param[]>(annotations.length === 0 ? [[fallback, []]] : []);
    for (const annotation of annotations) {
        for (const componentName of annotation.styleComponent ?? [fallback]) {
            paramsByComponent.set(componentName, [
                ...(paramsByComponent.get(componentName) ?? []),
                toParam(annotation),
            ]);
        }
    }

    for (const [componentName, params] of paramsByComponent) {
        if (fileByComponent.has(componentName)) {
            duplicates.set(componentName, [
                ...(duplicates.get(componentName) ?? [relative(process.cwd(), fileByComponent.get(componentName)!)]),
                location,
            ]);
            continue;
        }
        fileByComponent.set(componentName, file);
        components.push({
            componentName,
            params: params.sort((left, right) => byName(left.paramName, right.paramName)),
        });
    }
}

if (duplicates.size > 0) {
    throw new Error(
        `Style API meta: component names must be unique:\n${[...duplicates]
            .map(([name, files]) => `  ${name}: ${files.join(', ')}`)
            .join('\n')}`,
    );
}

const metadata = components.sort((left, right) => byName(left.componentName, right.componentName));
const summary = `${metadata.length} Style API declarations from ${source.name}@${source.version} (${skipped} token files without annotations skipped)`;

const cliDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(options.out ?? join(options.sdds ?? join(cliDirectory, '.sdds'), 'web', 'web-api-meta.json'));
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(metadata, null, 2)}\n`);
process.stdout.write(`Generated ${summary} at ${out}\n`);
