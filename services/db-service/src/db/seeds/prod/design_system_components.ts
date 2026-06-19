import * as schema from '../../schema';

export async function seedDesignSystemComponents(
    db: any,
    ctx: {
        designSystems: { base: any };
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
            chip: any;
            switchComponent: any;
            skeleton: any;
            list: any;
        };
    },
) {
    const { base } = ctx.designSystems;
    const {
        iconButton,
        button,
        link,
        checkbox,
        radiobox,
        counter,
        indicator,
        badge,
        spinner,
        chip,
        switchComponent,
        skeleton,
        list,
    } = ctx.components;

    const rows = await db
        .insert(schema.designSystemComponents)
        .values([
            { designSystemId: base.id, componentId: iconButton.id },
            { designSystemId: base.id, componentId: button.id },
            { designSystemId: base.id, componentId: link.id },
            { designSystemId: base.id, componentId: checkbox.id },
            { designSystemId: base.id, componentId: radiobox.id },
            { designSystemId: base.id, componentId: counter.id },
            { designSystemId: base.id, componentId: indicator.id },
            { designSystemId: base.id, componentId: badge.id },
            { designSystemId: base.id, componentId: spinner.id },
            { designSystemId: base.id, componentId: chip.id },
            { designSystemId: base.id, componentId: switchComponent.id },
            { designSystemId: base.id, componentId: skeleton.id },
            { designSystemId: base.id, componentId: list.id },
        ])
        .onConflictDoNothing()
        .returning();

    console.log(`  design_system_components: ${rows.length} rows`);
}
