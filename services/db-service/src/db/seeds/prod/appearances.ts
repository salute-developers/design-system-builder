import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedAppearances(
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
            linkButton: any;
            embedIconButton: any;
            cell: any;
            divider: any;
            emptyState: any;
            accordion: any;
            slider: any;
            note: any;
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
        linkButton,
        embedIconButton,
        cell,
        divider,
        emptyState,
        accordion,
        slider,
        note,
    } = ctx.components;

    const values = [
        { designSystemId: base.id, componentId: iconButton.id, name: 'default' },
        { designSystemId: base.id, componentId: button.id, name: 'default' },
        { designSystemId: base.id, componentId: link.id, name: 'default' },
        { designSystemId: base.id, componentId: checkbox.id, name: 'default' },
        { designSystemId: base.id, componentId: radiobox.id, name: 'default' },
        { designSystemId: base.id, componentId: counter.id, name: 'default' },
        { designSystemId: base.id, componentId: indicator.id, name: 'default' },
        { designSystemId: base.id, componentId: badge.id, name: 'default' },
        { designSystemId: base.id, componentId: spinner.id, name: 'default' },
        { designSystemId: base.id, componentId: chip.id, name: 'default' },
        { designSystemId: base.id, componentId: switchComponent.id, name: 'default' },
        { designSystemId: base.id, componentId: skeleton.id, name: 'default' },
        { designSystemId: base.id, componentId: list.id, name: 'default' },
        { designSystemId: base.id, componentId: linkButton.id, name: 'default' },
        { designSystemId: base.id, componentId: embedIconButton.id, name: 'default' },
        { designSystemId: base.id, componentId: cell.id, name: 'default' },
        { designSystemId: base.id, componentId: divider.id, name: 'default' },
        { designSystemId: base.id, componentId: emptyState.id, name: 'default' },
        { designSystemId: base.id, componentId: accordion.id, name: 'default' },
        { designSystemId: base.id, componentId: slider.id, name: 'default' },
        { designSystemId: base.id, componentId: note.id, name: 'default' },
    ];

    await db.insert(schema.appearances).values(values).onConflictDoNothing();

    // Load all appearances for this DS (includes both newly inserted and pre-existing)
    const componentIds = [
        iconButton.id,
        button.id,
        link.id,
        checkbox.id,
        radiobox.id,
        counter.id,
        indicator.id,
        badge.id,
        spinner.id,
        chip.id,
        switchComponent.id,
        skeleton.id,
        list.id,
        linkButton.id,
        embedIconButton.id,
        cell.id,
        divider.id,
        emptyState.id,
        accordion.id,
        slider.id,
        note.id,
    ];
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
        base_ind_default: findByComp(indicator.id),
        base_bad_default: findByComp(badge.id),
        base_spi_default: findByComp(spinner.id),
        base_chi_default: findByComp(chip.id),
        base_swi_default: findByComp(switchComponent.id),
        base_ske_default: findByComp(skeleton.id),
        base_lis_default: findByComp(list.id),
        base_lin_default: findByComp(linkButton.id),
        base_emb_default: findByComp(embedIconButton.id),
        base_cel_default: findByComp(cell.id),
        base_div_default: findByComp(divider.id),
        base_emp_default: findByComp(emptyState.id),
        base_acc_default: findByComp(accordion.id),
        base_sli_default: findByComp(slider.id),
        base_not_default: findByComp(note.id),
    };

    console.log(`  appearances: ${rows.length} rows`);
    return a;
}
