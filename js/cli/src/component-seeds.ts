/**
 * Обновление `component-seeds.json` ds-service из пакета компонентов (`dsbuilder components fetch`, `import:plasma`).
 *
 *   npm run seeds:update -- --from <.sdds/components> --component=Attach --component=TextField:clear \
 *       [--dependency=Group:Button:reuse] [--seeds <file>] [--token-definitions <file>] [--dry-run]
 *
 * Из сидов ds-service заполняет каждую новую дизайн-систему. Команда переносит в них только названные компоненты
 * (`--component=<Имя>` — компонент целиком) и appearance (`--component=<Имя>:<appearance>`); остальные записи файла
 * не меняются. Значение с именем токена из `token-definitions.json` пишется как `token`, остальное — строкой в `value`;
 * состояния — отдельными значениями с `state`. Шаблоны web-параметров (`adjust`) не пишутся: они живут в
 * `web-adapter.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

import { componentKebab, type NativeConfig, type PackageMeta } from './component-package.ts';
import { isEntrypoint } from './entrypoint.ts';
import { cliDirectory } from './package-output.ts';

const DS_SERVICE = path.join(cliDirectory, '..', '..', 'backend-kt', 'ds-service');
export const DEFAULT_SEEDS = path.join(DS_SERVICE, 'feature-components', 'src', 'main', 'resources', 'component-seeds.json');
export const DEFAULT_TOKEN_DEFINITIONS = path.join(DS_SERVICE, 'feature-tokens', 'src', 'main', 'resources', 'token-definitions.json');

export type ValueSeed = {
    prop: string;
    token?: string;
    value?: string;
    state?: string | string[];
    adjust?: unknown[];
    styles?: Record<string, string>;
};
export type AppearanceSeed = {
    name: string;
    variations?: string[];
    defaults?: Record<string, string>;
    values?: Record<string, Record<string, ValueSeed[]>>;
    invariants?: ValueSeed[];
    combinations?: ValueSeed[];
};
export type VariationSeed = { name: string; description?: string; styles: Array<{ name: string; description?: string }> };
export type ComponentSeed = {
    name: string;
    propertyVariations: Array<{ property: string; variation: string }>;
    variations: VariationSeed[];
    appearances: AppearanceSeed[];
};
export type DependencySeed = { parent: string; child: string; type: string; order: number };
export type SeedPackage = { components: ComponentSeed[]; dependencies: DependencySeed[] };

/** Компонент или один его appearance, которые переносятся в сиды. */
export type SeedSelection = { component: string; appearance?: string };

type NativeEntry = NonNullable<NativeConfig['props']>[string] & { states?: Array<{ state: string[]; value: unknown }> };

/** Значение и его состояния в формате сидов. */
const toValueSeeds = (prop: string, native: NativeEntry, tokens: Set<string>, extra: Partial<ValueSeed> = {}): ValueSeed[] => {
    const seed = (raw: unknown, state?: string[]): ValueSeed => {
        const text = raw === undefined || raw === null ? '' : String(raw);
        const target = typeof raw === 'string' && tokens.has(raw) ? { token: text } : { value: text };
        return { prop, ...target, ...(state ? { state: state.length === 1 ? state[0] : state } : {}), ...extra };
    };
    return [
        seed(native.default ?? native.value),
        ...(native.states ?? []).map(({ state, value }) => seed(value, state)),
    ];
};

/** Самое частое описание вариации в уже записанных сидах; без совпадения — имя вариации. */
const variationDescriptions = (seeds: SeedPackage) => {
    const counts = new Map<string, Map<string, number>>();
    for (const component of seeds.components) {
        for (const variation of component.variations) {
            if (!variation.description) continue;
            const byText = counts.get(variation.name) ?? new Map<string, number>();
            byText.set(variation.description, (byText.get(variation.description) ?? 0) + 1);
            counts.set(variation.name, byText);
        }
    }
    return (name: string) => {
        const byText = counts.get(name);
        if (!byText) return name;
        return [...byText].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    };
};

/** Стили вариации в порядке пакета: перечисление из привязки или, у флага, стиль `true`. */
const bindingStyles = (config: NativeConfig, name: string) => {
    const binding = config.bindings.find((item) => item.name === name)!;
    if (binding.type === 'boolean') return ['true'];
    const fromValues = config.variations
        .filter((entry) => entry.binding.length === 1 && entry.binding[0].name === name)
        .map((entry) => String(entry.binding[0].value));
    return [...new Set([...(binding.values ?? []).map(String), ...fromValues])];
};

/** Один appearance пакета в формате сидов и его вклад в вариации и привязки свойств компонента. */
export const toAppearanceSeed = (name: string, config: NativeConfig, tokens: Set<string>) => {
    const values: Record<string, Record<string, ValueSeed[]>> = {};
    const combinations: ValueSeed[] = [];
    const propertyVariations: Array<{ property: string; variation: string }> = [];
    for (const entry of config.variations ?? []) {
        const props = (entry.props ?? {}) as Record<string, NativeEntry>;
        if (entry.binding.length === 1) {
            const [{ name: variation, value }] = entry.binding;
            const style = String(value);
            const list = Object.entries(props).flatMap(([prop, native]) => toValueSeeds(prop, native, tokens));
            if (list.length === 0) continue;
            (values[variation] ??= {})[style] = list;
            for (const prop of Object.keys(props)) propertyVariations.push({ property: prop, variation });
            continue;
        }
        const styles = Object.fromEntries(entry.binding.map(({ name: axis, value }) => [axis, String(value)]));
        combinations.push(...Object.entries(props).flatMap(([prop, native]) => toValueSeeds(prop, native, tokens, { styles })));
    }
    const defaults = Object.fromEntries(
        config.bindings.filter((item) => item.defaultValue !== undefined).map((item) => [item.name, String(item.defaultValue)]),
    );
    const invariants = Object.entries((config.props ?? {}) as Record<string, NativeEntry>).flatMap(([prop, native]) =>
        toValueSeeds(prop, native, tokens),
    );
    const appearance: AppearanceSeed = {
        name,
        defaults,
        values,
        invariants,
        ...(combinations.length ? { combinations } : {}),
    };
    const variations = config.bindings.map((binding) => ({ name: binding.name, styles: bindingStyles(config, binding.name) }));
    return { appearance, variations, propertyVariations };
};

const unique = <T>(items: T[], key: (item: T) => string) => {
    const seen = new Set<string>();
    return items.filter((item) => (seen.has(key(item)) ? false : (seen.add(key(item)), true)));
};

/**
 * Переносит в сиды выбранные компоненты и appearance пакета. Компонент без appearance в выборе заменяется целиком;
 * appearance добавляется или заменяется в существующем компоненте, остальные его appearance остаются.
 */
export const mergeSeeds = (
    seeds: SeedPackage,
    packageDir: string,
    selections: SeedSelection[],
    dependencies: DependencySeed[],
    tokens: Set<string>,
): SeedPackage => {
    const meta = JSON.parse(fs.readFileSync(path.join(packageDir, 'meta.json'), 'utf8')) as PackageMeta;
    const describe = variationDescriptions(seeds);
    const components = [...seeds.components];

    for (const { component, appearance: only } of selections) {
        const kebab = componentKebab(component);
        const entries = meta.components.filter(
            (entry) => entry.componentName === kebab && (only === undefined || entry.styleName === only),
        );
        if (entries.length === 0) {
            throw new Error(`В пакете ${packageDir} нет ${only ? `appearance «${only}» компонента` : 'компонента'} ${component}.`);
        }
        const converted = entries.map((entry) =>
            toAppearanceSeed(entry.styleName, JSON.parse(fs.readFileSync(path.join(packageDir, entry.config), 'utf8')), tokens),
        );
        const index = components.findIndex((item) => item.name === component);
        const previous = only !== undefined && index >= 0 ? components[index] : undefined;

        // Вариации: прежние (при добавлении appearance) и пакета, стили объединяются в порядке появления.
        const variationOrder = unique(
            [...(previous?.variations.map((item) => item.name) ?? []), ...converted.flatMap((item) => item.variations.map((v) => v.name))],
            (name) => name,
        );
        const variations: VariationSeed[] = variationOrder.map((name) => {
            const before = previous?.variations.find((item) => item.name === name);
            const styles = unique(
                [
                    ...(before?.styles ?? []),
                    ...converted.flatMap((item) => item.variations.find((v) => v.name === name)?.styles ?? []).map((style) => ({
                        name: style,
                        description: style,
                    })),
                ],
                (style) => style.name,
            );
            return { name, description: before?.description ?? describe(name), styles };
        });
        const propertyVariations = unique(
            [...(previous?.propertyVariations ?? []), ...converted.flatMap((item) => item.propertyVariations)],
            (item) => `${item.property}\u0000${item.variation}`,
        );
        const appearances = [
            ...(previous?.appearances.filter((item) => !converted.some((next) => next.appearance.name === item.name)) ?? []),
            ...converted.map((item) => item.appearance),
        ].map((item) => {
            // Свой список вариаций appearance пишется, только когда он отличается от списка компонента (Tabs vertical).
            const own = converted.find((next) => next.appearance.name === item.name);
            if (!own) return item;
            const names = own.variations.map((v) => v.name);
            const { variations: _drop, ...rest } = item;
            return names.join() === variationOrder.join() ? rest : { ...rest, variations: names };
        });

        const next: ComponentSeed = { name: component, propertyVariations, variations, appearances };
        if (index >= 0) components[index] = next;
        else components.push(next);
    }

    components.sort((a, b) => a.name.localeCompare(b.name));
    const parents = new Set(dependencies.map((item) => item.parent));
    const allDependencies = [...seeds.dependencies.filter((item) => !parents.has(item.parent)), ...dependencies].sort(
        (a, b) => a.parent.localeCompare(b.parent) || a.order - b.order,
    );
    return { components, dependencies: allDependencies };
};

/** Имена токенов, на которые сиды могут ссылаться через `token`. */
export const readTokenNames = (file: string) =>
    new Set((JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ name: string }>).map((item) => item.name));

/** `--dependency=Group:Button:reuse` по порядку флагов одного родителя. */
export const parseDependencies = (values: string[]): DependencySeed[] => {
    const order = new Map<string, number>();
    return values.map((value) => {
        const [parent, child, type] = value.split(':');
        if (!parent || !child || !['reuse', 'compose'].includes(type)) {
            throw new Error(`--dependency ожидает <Родитель>:<Ребёнок>:<reuse|compose>, получено «${value}».`);
        }
        const next = (order.get(parent) ?? 0) + 1;
        order.set(parent, next);
        return { parent, child, type, order: next };
    });
};

const usage = `Usage: npm run seeds:update -- --from <components dir> --component=<Name>[:<appearance>] ... [options]
  --from <dir>                 Component package: meta.json and <component>_<style>_config.json (components fetch)
  --component <Name[:app]>     Component to replace entirely, or one appearance to add or replace; repeatable
  --dependency <P:C:type>      Dependency of a listed parent (reuse|compose); replaces the parent's dependencies
  --seeds <file>               Seeds file (default: ds-service component-seeds.json)
  --token-definitions <file>   Token names for token references (default: ds-service token-definitions.json)
  --dry-run                    Print what would change without writing`;

export async function main(args: string[] = process.argv.slice(2)) {
    const { values } = parseArgs({
        args,
        options: {
            from: { type: 'string' },
            component: { type: 'string', multiple: true, default: [] },
            dependency: { type: 'string', multiple: true, default: [] },
            seeds: { type: 'string', default: DEFAULT_SEEDS },
            'token-definitions': { type: 'string', default: DEFAULT_TOKEN_DEFINITIONS },
            'dry-run': { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
        },
    });
    if (values.help || !values.from || values.component.length === 0) {
        console.log(usage);
        if (!values.help) process.exitCode = 1;
        return;
    }
    const selections = values.component.map((value) => {
        const [component, appearance] = value.split(':');
        return { component, ...(appearance ? { appearance } : {}) };
    });
    const seeds = JSON.parse(fs.readFileSync(values.seeds, 'utf8')) as SeedPackage;
    const merged = mergeSeeds(
        seeds,
        path.resolve(values.from),
        selections,
        parseDependencies(values.dependency),
        readTokenNames(values['token-definitions']),
    );
    const appearances = (data: SeedPackage) => data.components.reduce((sum, item) => sum + item.appearances.length, 0);
    console.log(
        `components ${seeds.components.length} → ${merged.components.length}, appearances ${appearances(seeds)} → ${appearances(merged)}, ` +
            `dependencies ${seeds.dependencies.length} → ${merged.dependencies.length}`,
    );
    if (values['dry-run']) return;
    // Формат текущего файла: компактный JSON без перевода строки в конце.
    fs.writeFileSync(values.seeds, JSON.stringify(merged));
    console.log(`Written: ${values.seeds}`);
}

if (isEntrypoint(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
