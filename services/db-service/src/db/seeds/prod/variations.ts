import { sql } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedVariations(
    db: any,
    ctx: {
        components: {
            iconButton: any;
            button: any;
            link: any;
            checkbox: any;
            radiobox: any;
            counter: any;
            indicator: any;
            badge: any;
            spinner: any;
        };
    },
) {
    const { iconButton, button, link, checkbox, radiobox, counter, indicator, badge, spinner } = ctx.components;

    const rows = await db
        .insert(schema.variations)
        .values([
            // IconButton
            { componentId: iconButton.id, name: 'view', description: 'View variation' },
            { componentId: iconButton.id, name: 'size', description: 'Size variation' },
            { componentId: iconButton.id, name: 'shape', description: 'Shape variation' },
            // Button
            { componentId: button.id, name: 'view', description: 'View variation' },
            { componentId: button.id, name: 'size', description: 'Size variation' },
            { componentId: button.id, name: 'shape', description: 'Shape variation' },
            // Link
            { componentId: link.id, name: 'view', description: 'View variation' },
            { componentId: link.id, name: 'size', description: 'Size variation' },
            // Checkbox
            { componentId: checkbox.id, name: 'view', description: 'View variation' },
            { componentId: checkbox.id, name: 'size', description: 'Size variation' },
            // Radiobox
            { componentId: radiobox.id, name: 'view', description: 'View variation' },
            { componentId: radiobox.id, name: 'size', description: 'Size variation' },
            // Counter
            { componentId: counter.id, name: 'size', description: 'Размер.' },
            { componentId: counter.id, name: 'view', description: 'Вид.' },
            // Indicator
            { componentId: indicator.id, name: 'size', description: 'Размер.' },
            { componentId: indicator.id, name: 'view', description: 'Вид.' },
            // Badge
            { componentId: badge.id, name: 'view', description: 'Вид.' },
            { componentId: badge.id, name: 'size', description: 'Размер.' },
            { componentId: badge.id, name: 'shape', description: 'Форма.' },
            // Spinner
            { componentId: spinner.id, name: 'size', description: 'Размер.' },
            { componentId: spinner.id, name: 'view', description: 'Вид.' },
        ])
        .onConflictDoUpdate({
            target: [schema.variations.componentId, schema.variations.name],
            set: { description: sql`excluded.description` },
        })
        .returning();

    const find = (compId: string, name: string) => rows.find((r: any) => r.componentId === compId && r.name === name)!;

    const v = {
        iconButtonView: find(iconButton.id, 'view'),
        iconButtonSize: find(iconButton.id, 'size'),
        iconButtonShape: find(iconButton.id, 'shape'),
        buttonView: find(button.id, 'view'),
        buttonSize: find(button.id, 'size'),
        buttonShape: find(button.id, 'shape'),
        linkView: find(link.id, 'view'),
        linkSize: find(link.id, 'size'),
        checkboxView: find(checkbox.id, 'view'),
        checkboxSize: find(checkbox.id, 'size'),
        radioboxView: find(radiobox.id, 'view'),
        radioboxSize: find(radiobox.id, 'size'),
        // Counter
        counterSize: find(counter.id, 'size'),
        counterView: find(counter.id, 'view'),
        // Indicator
        indicatorSize: find(indicator.id, 'size'),
        indicatorView: find(indicator.id, 'view'),
        // Badge
        badgeView: find(badge.id, 'view'),
        badgeSize: find(badge.id, 'size'),
        badgeShape: find(badge.id, 'shape'),
        // Spinner
        spinnerSize: find(spinner.id, 'size'),
        spinnerView: find(spinner.id, 'view'),
    };

    console.log(`  variations: ${rows.length} rows`);
    return v;
}
