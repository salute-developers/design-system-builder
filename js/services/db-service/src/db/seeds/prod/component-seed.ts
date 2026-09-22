import fs from 'fs';
import path from 'path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../../schema';
import { makeStateSetResolver, SENTINEL_STATE_SET_ID } from '../state-sets';

/**
 * Сид компонента: всё, что относится к одному компоненту, лежит в его папке
 * `components/<имя>/` и описано данными, без идентификаторов. Ссылки между таблицами
 * (свойство, стиль, токен) задаются именами, сидер разрешает их сам.
 *
 * Добавить компонент — создать папку, убрать — удалить папку: реестра нет, папки находятся сами.
 */

export type PropertyType = 'color' | 'dimension' | 'float' | 'shadow' | 'shape' | 'typography' | 'value';
export type PropertyPlatform = 'web' | 'xml' | 'compose' | 'ios';
export type State = 'pressed' | 'hovered' | 'focused' | 'selected' | 'activated' | 'readonly' | 'disabled';

export type PropertySeed = {
    name: string;
    type: PropertyType;
    description?: string;
    defaultValue?: string;
    /** Вариации, в панели которых свойство показывается. */
    variations?: string[];
    /** Имена параметра на платформах; у web это ключ объекта токенов ядра. */
    params?: Partial<Record<PropertyPlatform, string[]>>;
};

export type StyleSeed = { name: string; description?: string };

/** Вариация и её стили общие для всех appearance компонента; порядок стилей — порядок в панели. */
export type VariationSeed = { name: string; description?: string; styles: StyleSeed[] };

/** Поправка значения для параметра платформы: своё число или шаблон (`$1 1rem`). */
export type AdjustSeed = { platform: PropertyPlatform; param: string; value?: string; template?: string };

export type ValueSeed = {
    prop: string;
    token?: string;
    value?: string;
    state?: State | State[];
    adjust?: AdjustSeed[];
};

/** Значение на сочетании стилей разных вариаций: `{ view: 'clear', itemView: 'accent' }`. */
export type CombinationSeed = ValueSeed & { styles: Record<string, string> };

/** Значения по стилям: `values[вариация][стиль]`. */
export type ValuesSeed = Record<string, Record<string, ValueSeed[]>>;

/**
 * Конфиг оформления компонента (appearance). Обычно один, `default`. У Tabs их два —
 * `horizontal` и `vertical`: общие токены и вариации, но свой состав вариаций, свои дефолты и
 * значения, в пакете — отдельный файл конфига и свой базовый конфиг ядра.
 */
export type AppearanceSeed = {
    name: string;
    /** Вариации этого appearance в порядке панели; без поля — все вариации компонента в порядке объявления. */
    variations?: string[];
    /** Стиль по умолчанию по вариации. Вариация без записи — без дефолта: у флага (`pilled`) это «выключено». */
    defaults?: Record<string, string>;
    values: ValuesSeed;
    invariants?: ValueSeed[];
    combinations?: CombinationSeed[];
};

export type ComponentSeed = {
    name: string;
    description?: string;
    properties: PropertySeed[];
    variations: VariationSeed[];
    appearances: AppearanceSeed[];
};

/** Платформа, которой размечаются свойства и appearance сидов: нативные строки сюда не попадают. */
const SEED_PLATFORM = 'web' as const;
const CHUNK = 1000;

const componentsDir = path.join(__dirname, 'components');

/** Имя папки компонента: `SegmentItem` -> `segmentItem`. */
export const componentDirName = (componentName: string) =>
    componentName.charAt(0).toLowerCase() + componentName.slice(1);

/** Все сиды компонентов: каждая папка в `components/` экспортирует `seed`. */
export function loadComponentSeeds(): ComponentSeed[] {
    return fs
        .readdirSync(componentsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .map((dir) => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require(path.join(componentsDir, dir));
            if (!mod.seed) throw new Error(`components/${dir}/index.ts не экспортирует seed`);
            return mod.seed as ComponentSeed;
        });
}

const chunked = <T>(rows: T[]) => {
    const out: T[][] = [];
    for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
    return out;
};

type Ctx = { designSystem: { id: string }; tokenMap: Record<string, { id: string }> };

/**
 * Записывает компоненты в базу. Глобальные строки (компонент, вариации, свойства) обновляются,
 * строки дизайн-системы (стили, значения) вставляются: перед повторным сидом их чистит вызывающий.
 */
export async function seedComponents(db: any, ctx: Ctx, seeds: ComponentSeed[]) {
    const resolveStateSet = makeStateSetResolver(db);
    const totals = { styles: 0, values: 0, invariants: 0, adjustments: 0, combinations: 0, appearances: 0 };

    for (const seed of seeds) {
        const where = (what: string) => `${seed.name}: ${what}`;

        const [component] = await db
            .insert(schema.components)
            .values([{ name: seed.name, description: seed.description ?? '' }])
            .onConflictDoUpdate({ target: schema.components.name, set: { description: sql`excluded.description` } })
            .returning();

        await db
            .insert(schema.designSystemComponents)
            .values([{ designSystemId: ctx.designSystem.id, componentId: component.id }])
            .onConflictDoNothing();

        // ── Вариации и свойства: глобальные, обновляются по имени ─────────────────
        const variationRows: any[] = seed.variations.length
            ? await db
                  .insert(schema.variations)
                  .values(
                      seed.variations.map((v) => ({
                          componentId: component.id,
                          name: v.name,
                          description: v.description ?? '',
                      })),
                  )
                  .onConflictDoUpdate({
                      target: [schema.variations.componentId, schema.variations.name],
                      set: { description: sql`excluded.description` },
                  })
                  .returning()
            : [];
        const variationId = (name: string) => {
            const row = variationRows.find((r) => r.name === name);
            if (!row) throw new Error(where(`нет вариации ${name}`));
            return row.id as string;
        };

        const propertyRows: any[] = [];
        for (const part of chunked(seed.properties)) {
            propertyRows.push(
                ...(await db
                    .insert(schema.properties)
                    .values(
                        part.map((p) => ({
                            componentId: component.id,
                            name: p.name,
                            type: p.type,
                            defaultValue: p.defaultValue ?? '',
                            description: p.description ?? '',
                            platform: SEED_PLATFORM,
                        })),
                    )
                    .onConflictDoUpdate({
                        target: [schema.properties.componentId, schema.properties.name],
                        set: {
                            type: sql`excluded.type`,
                            defaultValue: sql`excluded.default_value`,
                            description: sql`excluded.description`,
                            platform: sql`excluded.platform`,
                        },
                    })
                    .returning()),
            );
        }
        const propertyId = (name: string) => {
            const row = propertyRows.find((r) => r.name === name);
            if (!row) throw new Error(where(`нет свойства ${name}`));
            return row.id as string;
        };

        const paramRows = seed.properties.flatMap((p) =>
            Object.entries(p.params ?? {}).flatMap(([platform, names]) =>
                (names ?? []).map((name) => ({ propertyId: propertyId(p.name), platform, name })),
            ),
        );
        for (const part of chunked(paramRows)) {
            await db.insert(schema.propertyPlatformParams).values(part).onConflictDoNothing();
        }
        const params: any[] = propertyRows.length
            ? await db
                  .select()
                  .from(schema.propertyPlatformParams)
                  .where(
                      inArray(
                          schema.propertyPlatformParams.propertyId,
                          propertyRows.map((r) => r.id),
                      ),
                  )
            : [];
        const paramId = (prop: string, adjust: AdjustSeed) => {
            const id = propertyId(prop);
            const row = params.find(
                (r) => r.propertyId === id && r.platform === adjust.platform && r.name === adjust.param,
            );
            if (!row) throw new Error(where(`у свойства ${prop} нет параметра ${adjust.platform}:${adjust.param}`));
            return row.id as string;
        };

        const propertyVariationRows = seed.properties.flatMap((p) =>
            (p.variations ?? []).map((v) => ({ propertyId: propertyId(p.name), variationId: variationId(v) })),
        );
        for (const part of chunked(propertyVariationRows)) {
            await db.insert(schema.propertyVariations).values(part).onConflictDoNothing();
        }

        // ── Стили: принадлежат дизайн-системе, общие для всех appearance ───────────
        const styleSeeds = seed.variations.flatMap((v) =>
            v.styles.map((s) => ({
                designSystemId: ctx.designSystem.id,
                variationId: variationId(v.name),
                name: s.name,
                description: s.description ?? '',
            })),
        );
        const styleRows: any[] = styleSeeds.length
            ? await db
                  .insert(schema.styles)
                  .values(styleSeeds)
                  .onConflictDoUpdate({
                      target: [schema.styles.designSystemId, schema.styles.variationId, schema.styles.name],
                      set: { description: sql`excluded.description` },
                  })
                  .returning()
            : [];
        totals.styles += styleRows.length;
        const styleId = (variation: string, style: string) => {
            const vid = variationId(variation);
            const row = styleRows.find((r) => r.variationId === vid && r.name === style);
            if (!row) throw new Error(where(`нет стиля ${variation}.${style}`));
            return row.id as string;
        };

        const tokenId = (value: ValueSeed) => {
            if (!value.token) return null;
            const token = ctx.tokenMap[value.token];
            if (!token) throw new Error(where(`у свойства ${value.prop} неизвестный токен ${value.token}`));
            return token.id;
        };
        const stateSetId = async (value: ValueSeed) => {
            const states = value.state === undefined ? [] : [value.state].flat();
            if (states.length > 1) throw new Error(where(`набор из нескольких состояний у ${value.prop} сид не поддерживает`));
            return (await resolveStateSet(states[0] ?? null)) as string;
        };

        for (const appearanceSeed of seed.appearances) {
            const at = (what: string) => where(`appearance ${appearanceSeed.name}: ${what}`);
            await db
                .insert(schema.appearances)
                .values([
                    {
                        designSystemId: ctx.designSystem.id,
                        componentId: component.id,
                        name: appearanceSeed.name,
                        platform: SEED_PLATFORM,
                    },
                ])
                .onConflictDoNothing();
            const [appearance] = await db
                .select()
                .from(schema.appearances)
                .where(
                    and(
                        eq(schema.appearances.designSystemId, ctx.designSystem.id),
                        eq(schema.appearances.componentId, component.id),
                        eq(schema.appearances.name, appearanceSeed.name),
                        eq(schema.appearances.platform, SEED_PLATFORM),
                    ),
                );
            totals.appearances += 1;

            // ── Объявление вариаций appearance: состав, порядок, дефолт, порядок стилей ──
            const declaredNames = appearanceSeed.variations ?? seed.variations.map((v) => v.name);
            for (const [variationName, defaultStyle] of Object.entries(appearanceSeed.defaults ?? {})) {
                if (!declaredNames.includes(variationName)) throw new Error(at(`дефолт у вариации ${variationName}, которой нет в appearance`));
                styleId(variationName, defaultStyle);
            }
            for (const [position, variationName] of declaredNames.entries()) {
                const variation = seed.variations.find((v) => v.name === variationName);
                if (!variation) throw new Error(at(`нет вариации ${variationName}`));
                const defaultStyle = appearanceSeed.defaults?.[variationName];
                const [declared] = await db
                    .insert(schema.appearanceVariations)
                    .values({
                        appearanceId: appearance.id,
                        variationId: variationId(variationName),
                        position,
                        defaultStyleId: defaultStyle ? styleId(variationName, defaultStyle) : null,
                    })
                    .onConflictDoUpdate({
                        target: [schema.appearanceVariations.appearanceId, schema.appearanceVariations.variationId],
                        set: { position: sql`excluded.position`, defaultStyleId: sql`excluded.default_style_id` },
                    })
                    .returning();
                for (const [stylePosition, style] of variation.styles.entries()) {
                    await db
                        .insert(schema.appearanceVariationValues)
                        .values({
                            appearanceVariationId: declared.id,
                            styleId: styleId(variationName, style.name),
                            position: stylePosition,
                        })
                        .onConflictDoUpdate({
                            target: [
                                schema.appearanceVariationValues.appearanceVariationId,
                                schema.appearanceVariationValues.styleId,
                            ],
                            set: { position: sql`excluded.position` },
                        });
                }
            }

            // ── Значения ────────────────────────────────────────────────────────────
            type Pending = { key: string; adjust: AdjustSeed[]; prop: string };
            const pendingAdjust: Pending[] = [];
            const valueRows: any[] = [];
            for (const [variation, byStyle] of Object.entries(appearanceSeed.values)) {
                if (!declaredNames.includes(variation)) throw new Error(at(`значения у вариации ${variation}, которой нет в appearance`));
                for (const [style, list] of Object.entries(byStyle)) {
                    for (const value of list) {
                        const row = {
                            propertyId: propertyId(value.prop),
                            styleId: styleId(variation, style),
                            appearanceId: appearance.id,
                            tokenId: tokenId(value),
                            value: value.value ?? null,
                            stateSetId: await stateSetId(value),
                        };
                        valueRows.push(row);
                        if (value.adjust?.length) {
                            pendingAdjust.push({
                                key: `${row.propertyId}:${row.styleId}:${row.stateSetId}`,
                                adjust: value.adjust,
                                prop: value.prop,
                            });
                        }
                    }
                }
            }
            for (const part of chunked(valueRows)) {
                await db.insert(schema.variationPropertyValues).values(part).onConflictDoNothing();
            }
            totals.values += valueRows.length;

            if (pendingAdjust.length) {
                const stored: any[] = await db
                    .select()
                    .from(schema.variationPropertyValues)
                    .where(eq(schema.variationPropertyValues.appearanceId, appearance.id));
                const vpvId = new Map(stored.map((r) => [`${r.propertyId}:${r.styleId}:${r.stateSetId}`, r.id]));
                const adjustRows = pendingAdjust.flatMap((p) =>
                    p.adjust.map((a) => ({
                        vpvId: vpvId.get(p.key)!,
                        platformParamId: paramId(p.prop, a),
                        value: a.value ?? null,
                        template: a.template ?? null,
                    })),
                );
                for (const part of chunked(adjustRows)) {
                    await db.insert(schema.variationPlatformParamAdjustments).values(part).onConflictDoNothing();
                }
                totals.adjustments += adjustRows.length;
            }

            // ── Инварианты ──────────────────────────────────────────────────────────
            for (const value of appearanceSeed.invariants ?? []) {
                const [ipv] = await db
                    .insert(schema.invariantPropertyValues)
                    .values([
                        {
                            propertyId: propertyId(value.prop),
                            designSystemId: ctx.designSystem.id,
                            componentId: component.id,
                            appearanceId: appearance.id,
                            tokenId: tokenId(value),
                            value: value.value ?? null,
                            stateSetId: await stateSetId(value),
                        },
                    ])
                    .onConflictDoNothing()
                    .returning();
                totals.invariants += 1;
                if (ipv && value.adjust?.length) {
                    await db
                        .insert(schema.invariantPlatformParamAdjustments)
                        .values(
                            value.adjust.map((a) => ({
                                ipvId: ipv.id,
                                platformParamId: paramId(value.prop, a),
                                value: a.value ?? null,
                                template: a.template ?? null,
                            })),
                        )
                        .onConflictDoNothing();
                }
            }

            // ── Сочетания стилей ────────────────────────────────────────────────────
            for (const combo of appearanceSeed.combinations ?? []) {
                const members = Object.entries(combo.styles).map(([variation, style]) => styleId(variation, style));
                const combinationKey = [...members].sort().join(',');
                // Уникального индекса по ключу сочетания нет (см. schema.ts), повтор отсеивается здесь.
                const [existing] = await db
                    .select()
                    .from(schema.styleCombinations)
                    .where(
                        and(
                            eq(schema.styleCombinations.propertyId, propertyId(combo.prop)),
                            eq(schema.styleCombinations.appearanceId, appearance.id),
                            eq(schema.styleCombinations.combinationKey, combinationKey),
                            eq(schema.styleCombinations.stateSetId, SENTINEL_STATE_SET_ID),
                        ),
                    );
                if (existing) continue;
                const [row] = await db
                    .insert(schema.styleCombinations)
                    .values({
                        propertyId: propertyId(combo.prop),
                        appearanceId: appearance.id,
                        combinationKey,
                        // `value` обязателен: для токена в нём лежит имя токена, как в остальных таблицах значений.
                        tokenId: tokenId(combo),
                        value: combo.value ?? combo.token ?? '',
                        stateSetId: SENTINEL_STATE_SET_ID,
                    })
                    .onConflictDoNothing()
                    .returning();
                if (!row) continue;
                totals.combinations += 1;
                await db
                    .insert(schema.styleCombinationMembers)
                    .values(members.map((id) => ({ combinationId: row.id, styleId: id })))
                    .onConflictDoNothing();
            }
        }

        console.log(
            `  ${seed.name}: ${seed.properties.length} свойств, ${styleRows.length} стилей, ${seed.appearances.length} appearance`,
        );
    }

    console.log(
        `  итого: ${seeds.length} компонентов, ${totals.appearances} appearance, ${totals.styles} стилей, ${totals.values} значений, ` +
            `${totals.invariants} инвариантов, ${totals.adjustments} поправок, ${totals.combinations} сочетаний`,
    );
}
