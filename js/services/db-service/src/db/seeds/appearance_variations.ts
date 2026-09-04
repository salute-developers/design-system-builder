import { sql } from 'drizzle-orm';
import * as schema from '../schema';

/** Объявление стиля в сиде: строка `styles` плюс отметка «значение оси по умолчанию». */
export interface DeclaredStyle {
    designSystemId: string;
    variationId: string;
    name: string;
    isDefault: boolean;
}

/**
 * Заполняет объявление осей вариаций по объявлениям стилей сида.
 *
 * Объявление оси принадлежит appearance, а не дизайн-системе: одна и та же ось у двух стилей
 * одного компонента может иметь разный порядок, состав и дефолт. Поэтому ось объявляется на
 * каждом appearance той дизайн-системы, к которой относится стиль.
 *
 * Порядок берётся из порядка объявления, а не из имён: у оси `size` значения `xs, s, m, l`
 * упорядочены по величине, и сортировка по алфавиту переставила бы их. Реальный порядок
 * приходит с `components push`; здесь он лишь детерминирован.
 */
export async function seedAppearanceVariations(
    db: any,
    ctx: {
        declared: DeclaredStyle[];
        styleId: (variationId: string, name: string) => string;
        variations: Record<string, any>;
        appearances: Record<string, any>;
    },
) {
    const { declared, styleId, variations, appearances } = ctx;

    const componentIdByVariation = new Map<string, string>();
    for (const variation of Object.values(variations)) {
        componentIdByVariation.set(variation.id, variation.componentId);
    }

    // Один компонент может иметь несколько appearance в одной ДС, поэтому список, а не строка.
    const appearancesByKey = new Map<string, any[]>();
    for (const appearance of Object.values(appearances)) {
        const key = `${appearance.designSystemId}:${appearance.componentId}`;
        appearancesByKey.set(key, [...(appearancesByKey.get(key) ?? []), appearance]);
    }

    const axesByAppearance = new Map<string, string[]>();
    const valuesByAxis = new Map<string, string[]>();
    for (const row of declared) {
        const componentId = componentIdByVariation.get(row.variationId);
        if (!componentId) continue;

        for (const appearance of appearancesByKey.get(`${row.designSystemId}:${componentId}`) ?? []) {
            const axes = axesByAppearance.get(appearance.id) ?? [];
            if (!axes.includes(row.variationId)) axes.push(row.variationId);
            axesByAppearance.set(appearance.id, axes);

            const key = `${appearance.id}:${row.variationId}`;
            valuesByAxis.set(key, [...(valuesByAxis.get(key) ?? []), row.name]);
        }
    }

    let axisCount = 0;
    let valueCount = 0;
    for (const [appearanceId, axes] of axesByAppearance) {
        for (const [position, variationId] of axes.entries()) {
            const names = valuesByAxis.get(`${appearanceId}:${variationId}`) ?? [];
            const defaultName = declared.find(
                (row) => row.variationId === variationId && row.isDefault && names.includes(row.name),
            )?.name;

            const [axis] = await db
                .insert(schema.appearanceVariations)
                .values({
                    appearanceId,
                    variationId,
                    position,
                    defaultStyleId: defaultName ? styleId(variationId, defaultName) : null,
                })
                .onConflictDoUpdate({
                    target: [schema.appearanceVariations.appearanceId, schema.appearanceVariations.variationId],
                    set: {
                        position: sql`excluded.position`,
                        defaultStyleId: sql`excluded.default_style_id`,
                    },
                })
                .returning();
            axisCount += 1;

            for (const [valuePosition, name] of names.entries()) {
                await db
                    .insert(schema.appearanceVariationValues)
                    .values({
                        appearanceVariationId: axis.id,
                        styleId: styleId(variationId, name),
                        position: valuePosition,
                    })
                    .onConflictDoUpdate({
                        target: [
                            schema.appearanceVariationValues.appearanceVariationId,
                            schema.appearanceVariationValues.styleId,
                        ],
                        set: { position: sql`excluded.position` },
                    });
                valueCount += 1;
            }
        }
    }

    console.log(`  appearance_variations: ${axisCount} axes, ${valueCount} values`);
}
