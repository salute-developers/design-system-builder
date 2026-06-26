import * as schema from '../../schema';

export async function seedInvariantPropertyValues(
    db: any,
    ctx: {
        designSystems: { base: any };
        components: {
            iconButton: any;
            button: any;
            link: any;
            checkbox: any;
            radiobox: any;
            chip: any;
            switchComponent: any;
            list: any;
            linkButton: any;
            embedIconButton: any;
            slider: any;
        };
        appearances: Record<string, any>;
        properties: Record<string, any>;
        tokenMap: Record<string, any>;
    },
) {
    const { base } = ctx.designSystems;
    const {
        iconButton,
        button,
        link,
        checkbox,
        radiobox,
        chip,
        switchComponent,
        list,
        linkButton,
        embedIconButton,
        slider,
    } = ctx.components;
    const a = ctx.appearances;
    const p = ctx.properties;
    const t = ctx.tokenMap;

    const rows = await db
        .insert(schema.invariantPropertyValues)
        .values([
            // IconButton
            {
                propertyId: p.ib_loadingAlpha.id,
                designSystemId: base.id,
                componentId: iconButton.id,
                appearanceId: a.base_ib_default.id,
                value: '0',
                state: null,
            },
            {
                propertyId: p.ib_disableAlpha.id,
                designSystemId: base.id,
                componentId: iconButton.id,
                appearanceId: a.base_ib_default.id,
                value: '0.4',
                state: null,
            },
            {
                propertyId: p.ib_focusColor.id,
                designSystemId: base.id,
                componentId: iconButton.id,
                appearanceId: a.base_ib_default.id,
                tokenId: t['text.default.accent'].id,
                state: null,
            },
            // Button
            {
                propertyId: p.btn_loadingAlpha.id,
                designSystemId: base.id,
                componentId: button.id,
                appearanceId: a.base_btn_default.id,
                value: '0',
                state: null,
            },
            {
                propertyId: p.btn_disableAlpha.id,
                designSystemId: base.id,
                componentId: button.id,
                appearanceId: a.base_btn_default.id,
                value: '0.4',
                state: null,
            },
            {
                propertyId: p.btn_focusColor.id,
                designSystemId: base.id,
                componentId: button.id,
                appearanceId: a.base_btn_default.id,
                tokenId: t['text.default.accent'].id,
                state: null,
            },
            // Link
            {
                propertyId: p.link_focusColor.id,
                designSystemId: base.id,
                componentId: link.id,
                appearanceId: a.base_link_default.id,
                tokenId: t['text.default.accent'].id,
                state: null,
            },
            {
                propertyId: p.link_disableAlpha.id,
                designSystemId: base.id,
                componentId: link.id,
                appearanceId: a.base_link_default.id,
                value: '0.4',
                state: null,
            },
            // Checkbox
            {
                propertyId: p.cb_focusColor.id,
                designSystemId: base.id,
                componentId: checkbox.id,
                appearanceId: a.base_cb_default.id,
                tokenId: t['text.default.accent'].id,
                state: null,
            },
            {
                propertyId: p.cb_disableAlpha.id,
                designSystemId: base.id,
                componentId: checkbox.id,
                appearanceId: a.base_cb_default.id,
                value: '0.4',
                state: null,
            },
            // Radiobox
            {
                propertyId: p.rb_disableAlpha.id,
                designSystemId: base.id,
                componentId: radiobox.id,
                appearanceId: a.base_rb_default.id,
                value: '0.4',
                state: null,
            },
            {
                propertyId: p.rb_focusColor.id,
                designSystemId: base.id,
                componentId: radiobox.id,
                appearanceId: a.base_rb_default.id,
                tokenId: t['text.default.accent'].id,
                state: null,
            },
            // Chip
            {
                propertyId: p.chi_disableAlpha.id,
                designSystemId: base.id,
                componentId: chip.id,
                appearanceId: a.base_chi_default.id,
                value: '0.4',
                state: null,
            },
            {
                propertyId: p.chi_focusColor.id,
                designSystemId: base.id,
                componentId: chip.id,
                appearanceId: a.base_chi_default.id,
                value: 'text.default.accent',
                state: null,
            },
            // Switch
            {
                propertyId: p.swi_disableAlpha.id,
                designSystemId: base.id,
                componentId: switchComponent.id,
                appearanceId: a.base_swi_default.id,
                value: '1',
                state: null,
            },
            {
                propertyId: p.swi_trackFocusColor.id,
                designSystemId: base.id,
                componentId: switchComponent.id,
                appearanceId: a.base_swi_default.id,
                value: 'surface.default.accent',
                state: null,
            },
            // List
            {
                propertyId: p.lis_listDisabledOpacity.id,
                designSystemId: base.id,
                componentId: list.id,
                appearanceId: a.base_lis_default.id,
                value: '0.4',
                state: null,
            },
            {
                propertyId: p.lis_listItemFocusColor.id,
                designSystemId: base.id,
                componentId: list.id,
                appearanceId: a.base_lis_default.id,
                value: 'surface.default.accent',
                state: null,
            },
            // LinkButton
            {
                propertyId: p.lin_linkButtonDisabledAlpha.id,
                designSystemId: base.id,
                componentId: linkButton.id,
                appearanceId: a.base_lin_default.id,
                value: '0.4',
                state: null,
            },
            {
                propertyId: p.lin_linkButtonFocusColor.id,
                designSystemId: base.id,
                componentId: linkButton.id,
                appearanceId: a.base_lin_default.id,
                value: 'text.default.accent',
                state: null,
            },
            // EmbedIconButton
            {
                propertyId: p.emb_embedIconButtonFocusColor.id,
                designSystemId: base.id,
                componentId: embedIconButton.id,
                appearanceId: a.base_emb_default.id,
                value: 'surface.default.accent',
                state: null,
            },
            {
                propertyId: p.emb_embedIconButtonDisabledAlpha.id,
                designSystemId: base.id,
                componentId: embedIconButton.id,
                appearanceId: a.base_emb_default.id,
                value: '0.4',
                state: null,
            },
            // Slider
            {
                propertyId: p.sli_disabledAlpha.id,
                designSystemId: base.id,
                componentId: slider.id,
                appearanceId: a.base_sli_default.id,
                value: '1',
                state: null,
            },
        ])
        .onConflictDoNothing()
        .returning();

    console.log(`  invariant_property_values: ${rows.length} rows`);
    return rows;
}
