/**
 * Выгрузка компонентов из базы в сиды: `seeds/prod/components/<имя>/`.
 *
 *   npm run db:seed-generate:prod                       — все компоненты дизайн-системы base
 *   npm run db:seed-generate:prod -- --component=Select — один компонент
 *   npm run db:seed-generate:prod -- --ds=test          — из другой дизайн-системы
 *
 * Папка компонента переписывается целиком. Нужна, когда компонент собран или поправлен в
 * интерфейсе билдера и его состояние надо закрепить в сидах.
 */
import path from 'path';
import { client } from './index';
import {
    componentDirName,
    type AdjustSeed,
    type AppearanceSeed,
    type CombinationSeed,
    type ComponentSeed,
    type State,
    type ValueSeed,
} from './seeds/prod/component-seed';
import { writeComponentSeed } from './seeds/prod/component-seed-writer';

const arg = (name: string) =>
    process.argv
        .find((a) => a.startsWith(`--${name}=`))
        ?.split('=')[1]
        .replace(/["']/g, '');

const componentsDir = path.join(__dirname, 'seeds', 'prod', 'components');

type Row = Record<string, any>;
const q = (text: string, params: any[] = []) => client.unsafe(text, params) as unknown as Promise<Row[]>;

const toAdjust = (rows: Row[]): AdjustSeed[] =>
    rows.map((a) => ({
        platform: a.platform,
        param: a.param,
        ...(a.value !== null ? { value: a.value } : {}),
        ...(a.template !== null ? { template: a.template } : {}),
    }));

/** Значение из строки базы: токен, строка, состояние, поправки. */
const toValue = (row: Row, adjust: Row[]): ValueSeed => {
    const states: State[] = row.states ?? [];
    return {
        prop: row.prop,
        ...(row.token ? { token: row.token } : {}),
        // У сочетаний в `value` дублируется имя токена — это восстановит сидер, в файле оно лишнее.
        ...(row.value !== null && row.value !== row.token ? { value: row.value } : {}),
        ...(states.length === 1 ? { state: states[0] } : states.length > 1 ? { state: states } : {}),
        ...(adjust.length ? { adjust: toAdjust(adjust) } : {}),
    };
};

async function exportAppearance(component: Row, dsId: string, appearance: Row, allVariations: Row[]): Promise<AppearanceSeed> {
    const variations = await q(
        `select v.id, v.name, av.position, ds.name as default_style
         from appearance_variations av join variations v on v.id = av.variation_id
         left join styles ds on ds.id = av.default_style_id
         where av.appearance_id = $1 order by av.position`,
        [appearance.id],
    );
    const styles = await q(
        `select s.variation_id, s.name from styles s join variations v on v.id = s.variation_id
         where v.component_id = $1 and s.design_system_id = $2 order by s.ctid`,
        [component.id, dsId],
    );
    const statesOf = `(select coalesce(array_agg(st.name order by st.name), '{}') from states st where st.id = any(ss.state_ids))`;
    const values = await q(
        `select x.id, p.name as prop, s.variation_id, s.name as style, t.name as token, x.value, ${statesOf} as states
         from variation_property_values x join styles s on s.id = x.style_id join properties p on p.id = x.property_id
         left join tokens t on t.id = x.token_id join state_sets ss on ss.id = x.state_set_id
         where x.appearance_id = $1 order by x.ctid`,
        [appearance.id],
    );
    const valueAdjust = await q(
        `select x.vpv_id as owner, pp.platform, pp.name as param, x.value, x.template
         from variation_platform_param_adjustments x join variation_property_values v on v.id = x.vpv_id
         join property_platform_params pp on pp.id = x.platform_param_id where v.appearance_id = $1 order by x.ctid`,
        [appearance.id],
    );
    const invariants = await q(
        `select x.id, p.name as prop, t.name as token, x.value, ${statesOf} as states
         from invariant_property_values x join properties p on p.id = x.property_id
         left join tokens t on t.id = x.token_id join state_sets ss on ss.id = x.state_set_id
         where x.appearance_id = $1 order by x.ctid`,
        [appearance.id],
    );
    const invariantAdjust = await q(
        `select x.ipv_id as owner, pp.platform, pp.name as param, x.value, x.template
         from invariant_platform_param_adjustments x join invariant_property_values v on v.id = x.ipv_id
         join property_platform_params pp on pp.id = x.platform_param_id where v.appearance_id = $1 order by x.ctid`,
        [appearance.id],
    );
    const combinations = await q(
        `select x.id, p.name as prop, t.name as token, x.value, ${statesOf} as states
         from style_combinations x join properties p on p.id = x.property_id
         left join tokens t on t.id = x.token_id join state_sets ss on ss.id = x.state_set_id
         where x.appearance_id = $1 order by x.ctid`,
        [appearance.id],
    );
    const combinationMembers = await q(
        `select m.combination_id as owner, v.name as variation, s.name as style
         from style_combination_members m join style_combinations c on c.id = m.combination_id
         join styles s on s.id = m.style_id join variations v on v.id = s.variation_id
         left join appearance_variations av on av.variation_id = v.id and av.appearance_id = c.appearance_id
         where c.appearance_id = $1 order by av.position nulls last, v.name`,
        [appearance.id],
    );
    const adjustOf = (rows: Row[], owner: string) => rows.filter((r) => r.owner === owner);

    const declaredNames = variations.map((v) => v.name);
    const sameAsAll = declaredNames.join(',') === allVariations.map((v) => v.name).join(',');
    const defaults = Object.fromEntries(variations.filter((v) => v.default_style).map((v) => [v.name, v.default_style]));

    return {
        name: appearance.name ?? 'default',
        ...(sameAsAll ? {} : { variations: declaredNames }),
        ...(Object.keys(defaults).length ? { defaults } : {}),
        values: Object.fromEntries(
            variations.map((v) => [
                v.name,
                Object.fromEntries(
                    styles
                        .filter((r) => r.variation_id === v.id)
                        .map((s) => [
                            s.name,
                            values
                                .filter((r) => r.variation_id === v.id && r.style === s.name)
                                .map((r) => toValue(r, adjustOf(valueAdjust, r.id))),
                        ]),
                ),
            ]),
        ),
        ...(invariants.length ? { invariants: invariants.map((r) => toValue(r, adjustOf(invariantAdjust, r.id))) } : {}),
        ...(combinations.length
            ? {
                  combinations: combinations.map(
                      (r): CombinationSeed => ({
                          ...toValue(r, []),
                          styles: Object.fromEntries(
                              combinationMembers.filter((m) => m.owner === r.id).map((m) => [m.variation, m.style]),
                          ),
                      }),
                  ),
              }
            : {}),
    };
}

async function exportComponent(component: Row, dsId: string) {
    const appearances = await q(
        `select id, name from appearances where design_system_id = $1 and component_id = $2 and platform = 'web' order by ctid`,
        [dsId, component.id],
    );
    if (!appearances.length) {
        console.log(`  ${component.name}: нет appearance в этой дизайн-системе, пропущен`);
        return false;
    }

    const properties = await q(
        `select p.id, p.name, p.type, p.description, p.default_value from properties p where p.component_id = $1 order by p.ctid`,
        [component.id],
    );
    const params = await q(
        `select pp.id, pp.property_id, pp.platform, pp.name from property_platform_params pp
         join properties p on p.id = pp.property_id where p.component_id = $1 order by pp.ctid`,
        [component.id],
    );
    // Порядок вариаций компонента — порядок в первом appearance, остальные вариации следом.
    const variations = await q(
        `select v.id, v.name, v.description, av.position
         from variations v
         left join appearance_variations av on av.variation_id = v.id and av.appearance_id = $2
         where v.component_id = $1 order by av.position nulls last, v.ctid`,
        [component.id, appearances[0].id],
    );
    const propertyVariations = await q(
        `select pv.property_id, v.name from property_variations pv join variations v on v.id = pv.variation_id
         where v.component_id = $1 order by pv.ctid`,
        [component.id],
    );
    const styles = await q(
        `select s.id, s.variation_id, s.name, s.description, avv.position
         from styles s join variations v on v.id = s.variation_id
         left join appearance_variations av on av.variation_id = v.id and av.appearance_id = $3
         left join appearance_variation_values avv on avv.appearance_variation_id = av.id and avv.style_id = s.id
         where v.component_id = $1 and s.design_system_id = $2 order by avv.position nulls last, s.ctid`,
        [component.id, dsId, appearances[0].id],
    );

    const appearanceSeeds: AppearanceSeed[] = [];
    for (const appearance of appearances) appearanceSeeds.push(await exportAppearance(component, dsId, appearance, variations));

    const seed: ComponentSeed = {
        name: component.name,
        ...(component.description ? { description: component.description } : {}),
        properties: properties.map((p) => {
            const inVariations = propertyVariations.filter((pv) => pv.property_id === p.id).map((pv) => pv.name);
            const byPlatform: Record<string, string[]> = {};
            for (const pp of params.filter((r) => r.property_id === p.id)) {
                byPlatform[pp.platform] = [...(byPlatform[pp.platform] ?? []), pp.name];
            }
            return {
                name: p.name,
                type: p.type,
                ...(p.description ? { description: p.description } : {}),
                ...(p.default_value ? { defaultValue: p.default_value } : {}),
                ...(inVariations.length ? { variations: inVariations } : {}),
                ...(Object.keys(byPlatform).length ? { params: byPlatform } : {}),
            };
        }),
        variations: variations.map((v) => ({
            name: v.name,
            ...(v.description ? { description: v.description } : {}),
            styles: styles
                .filter((r) => r.variation_id === v.id)
                .map((s) => ({ name: s.name, ...(s.description ? { description: s.description } : {}) })),
        })),
        appearances: appearanceSeeds,
    };

    writeComponentSeed(path.join(componentsDir, componentDirName(component.name)), seed);

    const count = (pick: (a: AppearanceSeed) => number) => appearanceSeeds.reduce((sum, a) => sum + pick(a), 0);
    console.log(
        `  ${component.name}: ${properties.length} свойств, ${styles.length} стилей, ${appearanceSeeds.length} appearance, ` +
            `${count((a) => Object.values(a.values).flatMap((s) => Object.values(s)).flat().length)} значений, ` +
            `${count((a) => a.invariants?.length ?? 0)} инвариантов, ${count((a) => a.combinations?.length ?? 0)} сочетаний`,
    );
    return true;
}

async function main() {
    const dsName = arg('ds') ?? 'base';
    const only = arg('component');
    const [ds] = await q(`select id from design_systems where name = $1`, [dsName]);
    if (!ds) throw new Error(`Дизайн-система ${dsName} не найдена`);

    const components = await q(
        `select c.id, c.name, c.description from components c
         join design_system_components x on x.component_id = c.id and x.design_system_id = $1
         where $2::text is null or c.name = $2 order by c.name`,
        [ds.id, only ?? null],
    );
    if (!components.length) throw new Error(only ? `Компонент ${only} не найден в ${dsName}` : `В ${dsName} нет компонентов`);

    console.log(`Выгрузка из ${dsName}: ${components.length} компонентов\n`);
    let written = 0;
    for (const component of components) written += (await exportComponent(component, ds.id)) ? 1 : 0;
    console.log(`\nЗаписано папок: ${written} в ${path.relative(process.cwd(), componentsDir)}`);
}

main()
    .catch((err) => {
        console.error('Export failed:', err);
        process.exit(1);
    })
    .finally(() => client.end());
