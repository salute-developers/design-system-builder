import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedAppearances(
    db: any,
    ctx: {
        designSystems: { base: any };
        components: { iconButton: any; button: any; link: any; checkbox: any; radiobox: any; counter: any };
    },
) {
    const { base } = ctx.designSystems;
    const { iconButton, button, link, checkbox, radiobox, counter } = ctx.components;

    const values = [
        { designSystemId: base.id, componentId: iconButton.id, name: 'default' },
        { designSystemId: base.id, componentId: button.id, name: 'default' },
        { designSystemId: base.id, componentId: link.id, name: 'default' },
        { designSystemId: base.id, componentId: checkbox.id, name: 'default' },
        { designSystemId: base.id, componentId: radiobox.id, name: 'default' },
        { designSystemId: base.id, componentId: counter.id, name: 'default' },
    ];

    await db.insert(schema.appearances).values(values).onConflictDoNothing();

    // Load all appearances for this DS (includes both newly inserted and pre-existing)
    const componentIds = [iconButton.id, button.id, link.id, checkbox.id, radiobox.id, counter.id];
    const rows = await db
        .select()
        .from(schema.appearances)
        .where(
            and(eq(schema.appearances.designSystemId, base.id), inArray(schema.appearances.componentId, componentIds)),
        );

    const findByComp = (compId: string) => rows.find((r: any) => r.componentId === compId)!;

    const a = {
        base_ib_default: findByComp(iconButton.id),
        base_btn_default: findByComp(button.id),
        base_link_default: findByComp(link.id),
        base_cb_default: findByComp(checkbox.id),
        base_rb_default: findByComp(radiobox.id),
        base_cou_default: findByComp(counter.id),
    };

    console.log(`  appearances: ${rows.length} rows`);
    return a;
}
