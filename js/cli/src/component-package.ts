import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Пакет `.sdds/components`: `meta.json` со списком конфигураций и native-конфиг на пару
 * «компонент, стиль». Формат тот же, что пишет `dsbuilder components fetch` и читает
 * `dsbuilder components push`: имена компонентов в kebab-case, файл `<component>_<style>_config.json`.
 */

export type PackageEntry = { componentName: string; styleName: string; config: string };
export type PackageMeta = { name: string; version: string; components: PackageEntry[] };

/** Значение свойства в native-формате: цвет и градиент в `default`, остальное в `value`. */
export type NativeValue = {
    type: string;
    value?: string | number;
    default?: string;
};

export type NativeBinding = {
    name: string;
    type: 'enum' | 'boolean';
    values?: string[];
    defaultValue?: string | boolean;
};

export type NativeVariation = {
    id: string;
    binding: Array<{ name: string; value: string | boolean }>;
    props: Record<string, NativeValue>;
};

export type NativeConfig = {
    props: Record<string, NativeValue>;
    bindings: NativeBinding[];
    variations: NativeVariation[];
};

/** Строка значения из разбора конфига plasma: токен темы либо литерал. */
export type ValueRow = { variation: string; style: string; prop: string; token: string | null; value: string | null };

export type AppearanceConfigInput = {
    /** Вариации appearance в порядке панели. */
    order: string[];
    /** Стили по вариации в порядке объявления. */
    stylesOf: Record<string, string[]>;
    /** Стиль по умолчанию по вариации. */
    defaults: Record<string, string>;
    variationRows: ValueRow[];
    invariantRows: ValueRow[];
    /** Тип свойства по имени. */
    propTypes: Map<string, string>;
};

const PAINT = new Set(['color', 'gradient']);
const NUMERIC = new Set(['dimension', 'float']);

/** Имя компонента в написании пакета: `IconTabItem` → `icon-tab-item`, как у `fetch`. */
export const componentKebab = (name: string) =>
    name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();

/** Имя файла конфига: `<component>_<style>_config.json`, как у `fetch`. */
export const configFileName = (componentName: string, styleName: string) =>
    `${componentName.replace(/-/g, '_')}_${styleName.replace(/-/g, '_')}_config.json`;

const toNativeValue = (type: string, row: ValueRow): NativeValue => {
    const raw = row.token ?? row.value ?? '';
    if (PAINT.has(type)) return { type, default: raw };
    if (NUMERIC.has(type) && row.token === null && raw !== '' && Number.isFinite(Number(raw))) {
        return { type, value: Number(raw) };
    }
    return { type, value: raw };
};

/** Вариация считается флагом, если единственный её стиль — `true`. */
const isFlag = (styles: string[]) => styles.length === 1 && styles[0] === 'true';

/** Собирает native-конфиг одного appearance из строк разбора. */
export function toNativeConfig(input: AppearanceConfigInput): NativeConfig {
    const typeOf = (prop: string) => {
        const type = input.propTypes.get(prop);
        if (!type) throw new Error(`Тип свойства ${prop} не определён`);
        return type;
    };
    const props: Record<string, NativeValue> = {};
    for (const row of input.invariantRows) props[row.prop] = toNativeValue(typeOf(row.prop), row);

    const bindings: NativeBinding[] = input.order.map((variation) => {
        const styles = input.stylesOf[variation] ?? [];
        if (isFlag(styles)) {
            // Флаг хранится как в ядре: единственный стиль `true`; `defaultValue: false` заставил бы
            // импорт завести стиль `false`, поэтому без дефолта поле опускается, как у `fetch`.
            return input.defaults[variation] === 'true'
                ? { name: variation, type: 'boolean', defaultValue: true }
                : { name: variation, type: 'boolean' };
        }
        const defaultValue = input.defaults[variation];
        return {
            name: variation,
            type: 'enum',
            values: styles,
            ...(defaultValue !== undefined ? { defaultValue } : {}),
        };
    });

    const variations: NativeVariation[] = [];
    for (const variation of input.order) {
        const flag = isFlag(input.stylesOf[variation] ?? []);
        for (const style of input.stylesOf[variation] ?? []) {
            const rows = input.variationRows.filter((row) => row.variation === variation && row.style === style);
            const styleProps: Record<string, NativeValue> = {};
            for (const row of rows) styleProps[row.prop] = toNativeValue(typeOf(row.prop), row);
            variations.push({
                id: style,
                binding: [{ name: variation, value: flag ? true : style }],
                props: styleProps,
            });
        }
    }
    return { props, bindings, variations };
}

const metaPath = (packageDir: string) => path.join(packageDir, 'meta.json');

/** Читает `meta.json` пакета; без пакета — пустой список с именем из аргумента. */
export function readPackageMeta(packageDir: string, name = 'package'): PackageMeta {
    const file = metaPath(packageDir);
    if (!fs.existsSync(file)) return { name, version: '0.1.0', components: [] };
    const meta = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<PackageMeta>;
    return { name: meta.name ?? name, version: meta.version ?? '0.1.0', components: meta.components ?? [] };
}

const writeJson = (file: string, value: unknown) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 4)}\n`);
};

/**
 * Записывает конфигурации компонента в пакет: записи этого компонента заменяются, остальные
 * остаются; файлы прежних стилей компонента, которых больше нет, удаляются. Возвращает имена файлов.
 */
export function writeComponentEntries(
    packageDir: string,
    component: string,
    configs: Array<{ styleName: string; config: NativeConfig }>,
    dryRun: boolean,
): string[] {
    const componentName = componentKebab(component);
    const meta = readPackageMeta(packageDir);
    const previous = meta.components.filter((entry) => entry.componentName === componentName);
    const entries: PackageEntry[] = configs.map(({ styleName }) => ({
        componentName,
        styleName,
        config: configFileName(componentName, styleName),
    }));
    const kept = meta.components.filter((entry) => entry.componentName !== componentName);
    const next: PackageMeta = { ...meta, components: [...kept, ...entries] };
    if (!dryRun) {
        for (const stale of previous.filter((entry) => !entries.some((e) => e.config === entry.config))) {
            fs.rmSync(path.join(packageDir, stale.config), { force: true });
        }
        configs.forEach(({ config }, index) => writeJson(path.join(packageDir, entries[index].config), config));
        writeJson(metaPath(packageDir), next);
    }
    return entries.map((entry) => entry.config);
}

/** Удаляет записи и файлы компонента из пакета; чужие записи не трогает. Возвращает удалённые файлы. */
export function removeComponentEntries(packageDir: string, component: string, dryRun: boolean): string[] {
    const componentName = componentKebab(component);
    const meta = readPackageMeta(packageDir);
    const removed = meta.components.filter((entry) => entry.componentName === componentName);
    if (!removed.length) return [];
    if (!dryRun) {
        for (const entry of removed) fs.rmSync(path.join(packageDir, entry.config), { force: true });
        writeJson(metaPath(packageDir), {
            ...meta,
            components: meta.components.filter((entry) => entry.componentName !== componentName),
        });
    }
    return removed.map((entry) => entry.config);
}
