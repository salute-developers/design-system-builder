import { sql } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedStyles(
    db: any,
    ctx: {
        designSystems: { base: any };
        variations: Record<string, any>;
    },
) {
    const { base } = ctx.designSystems;
    const v = ctx.variations;

    const rows = await db
        .insert(schema.styles)
        .values([
            // ── IconButton ──────────────────────────────────────────────────────────
            // View
            {
                designSystemId: base.id,
                variationId: v.iconButtonView.id,
                name: 'default',
                description: 'Default view',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.iconButtonView.id,
                name: 'secondary',
                description: 'Secondary view',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.iconButtonView.id,
                name: 'accent',
                description: 'Accent view',
                isDefault: false,
            },
            // Size
            {
                designSystemId: base.id,
                variationId: v.iconButtonSize.id,
                name: 'xl',
                description: 'Extra large size',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.iconButtonSize.id,
                name: 'l',
                description: 'Large size',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.iconButtonSize.id,
                name: 'm',
                description: 'Medium size',
                isDefault: true,
            },
            // Shape
            {
                designSystemId: base.id,
                variationId: v.iconButtonShape.id,
                name: 'rounded',
                description: 'Rounded shape',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.iconButtonShape.id,
                name: 'pilled',
                description: 'Pilled shape',
                isDefault: false,
            },

            // ── Button ──────────────────────────────────────────────────────────────
            // View
            {
                designSystemId: base.id,
                variationId: v.buttonView.id,
                name: 'default',
                description: 'Default view',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.buttonView.id,
                name: 'secondary',
                description: 'Secondary view',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.buttonView.id,
                name: 'accent',
                description: 'Accent view',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.buttonView.id,
                name: 'clear',
                description: 'Clear view',
                isDefault: false,
            },
            // Size
            {
                designSystemId: base.id,
                variationId: v.buttonSize.id,
                name: 'xl',
                description: 'Extra large size',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.buttonSize.id,
                name: 'l',
                description: 'Large size',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.buttonSize.id,
                name: 'm',
                description: 'Medium size',
                isDefault: true,
            },
            // Shape
            {
                designSystemId: base.id,
                variationId: v.buttonShape.id,
                name: 'rounded',
                description: 'Rounded shape',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.buttonShape.id,
                name: 'pilled',
                description: 'Pilled shape',
                isDefault: false,
            },

            // ── Link ────────────────────────────────────────────────────────────────
            // View
            {
                designSystemId: base.id,
                variationId: v.linkView.id,
                name: 'default',
                description: 'Default view',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.linkView.id,
                name: 'secondary',
                description: 'Secondary view',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.linkView.id,
                name: 'accent',
                description: 'Accent view',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.linkView.id,
                name: 'clear',
                description: 'Clear view',
                isDefault: false,
            },
            // Size
            {
                designSystemId: base.id,
                variationId: v.linkSize.id,
                name: 's',
                description: 'Small size',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.linkSize.id,
                name: 'm',
                description: 'Medium size',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.linkSize.id,
                name: 'l',
                description: 'Large size',
                isDefault: false,
            },

            // ── Checkbox ──────────────────────────────────────────────────────────────
            // View
            {
                designSystemId: base.id,
                variationId: v.checkboxView.id,
                name: 'accent',
                description: 'Accent view',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.checkboxView.id,
                name: 'negative',
                description: 'Negative view',
                isDefault: false,
            },
            // Size
            {
                designSystemId: base.id,
                variationId: v.checkboxSize.id,
                name: 's',
                description: 'Small size',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.checkboxSize.id,
                name: 'm',
                description: 'Medium size',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.checkboxSize.id,
                name: 'l',
                description: 'Large size',
                isDefault: false,
            },

            // ── Radiobox ──────────────────────────────────────────────────────────────
            // View
            {
                designSystemId: base.id,
                variationId: v.radioboxView.id,
                name: 'accent',
                description: 'Accent view',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.radioboxView.id,
                name: 'negative',
                description: 'Negative view',
                isDefault: false,
            },
            // Size
            {
                designSystemId: base.id,
                variationId: v.radioboxSize.id,
                name: 's',
                description: 'Small size',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.radioboxSize.id,
                name: 'm',
                description: 'Medium size',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.radioboxSize.id,
                name: 'l',
                description: 'Large size',
                isDefault: false,
            },

            // ── Counter ──────────────────────────────────────────────────────────
            { designSystemId: base.id, variationId: v.counterSize.id, name: 'l', description: '', isDefault: false },
            { designSystemId: base.id, variationId: v.counterSize.id, name: 'm', description: '', isDefault: false },
            { designSystemId: base.id, variationId: v.counterSize.id, name: 'S', description: '', isDefault: false },
            { designSystemId: base.id, variationId: v.counterSize.id, name: 'XS', description: '', isDefault: true },
            { designSystemId: base.id, variationId: v.counterSize.id, name: 'XXS', description: '', isDefault: false },
            {
                designSystemId: base.id,
                variationId: v.counterView.id,
                name: 'Accent',
                description: '',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.counterView.id,
                name: 'Positive',
                description: '',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.counterView.id,
                name: 'default',
                description: '',
                isDefault: true,
            },
            {
                designSystemId: base.id,
                variationId: v.counterView.id,
                name: 'warning',
                description: '',
                isDefault: false,
            },
            {
                designSystemId: base.id,
                variationId: v.counterView.id,
                name: 'Negative',
                description: '',
                isDefault: false,
            },
        ])
        .onConflictDoUpdate({
            target: [schema.styles.designSystemId, schema.styles.variationId, schema.styles.name],
            set: {
                description: sql`excluded.description`,
                isDefault: sql`excluded.is_default`,
            },
        })
        .returning();

    const find = (varId: string, name: string) => rows.find((r: any) => r.variationId === varId && r.name === name)!;

    const s = {
        // IconButton
        base_ib_view_default: find(v.iconButtonView.id, 'default'),
        base_ib_view_secondary: find(v.iconButtonView.id, 'secondary'),
        base_ib_view_accent: find(v.iconButtonView.id, 'accent'),
        base_ib_size_xl: find(v.iconButtonSize.id, 'xl'),
        base_ib_size_l: find(v.iconButtonSize.id, 'l'),
        base_ib_size_m: find(v.iconButtonSize.id, 'm'),
        base_ib_shape_rounded: find(v.iconButtonShape.id, 'rounded'),
        base_ib_shape_pilled: find(v.iconButtonShape.id, 'pilled'),
        // Button
        base_btn_view_default: find(v.buttonView.id, 'default'),
        base_btn_view_secondary: find(v.buttonView.id, 'secondary'),
        base_btn_view_accent: find(v.buttonView.id, 'accent'),
        base_btn_view_clear: find(v.buttonView.id, 'clear'),
        base_btn_size_xl: find(v.buttonSize.id, 'xl'),
        base_btn_size_l: find(v.buttonSize.id, 'l'),
        base_btn_size_m: find(v.buttonSize.id, 'm'),
        base_btn_shape_rounded: find(v.buttonShape.id, 'rounded'),
        base_btn_shape_pilled: find(v.buttonShape.id, 'pilled'),
        // Link
        base_link_view_default: find(v.linkView.id, 'default'),
        base_link_view_secondary: find(v.linkView.id, 'secondary'),
        base_link_view_accent: find(v.linkView.id, 'accent'),
        base_link_view_clear: find(v.linkView.id, 'clear'),
        base_link_size_s: find(v.linkSize.id, 's'),
        base_link_size_m: find(v.linkSize.id, 'm'),
        base_link_size_l: find(v.linkSize.id, 'l'),
        // Checkbox
        base_cb_view_accent: find(v.checkboxView.id, 'accent'),
        base_cb_view_negative: find(v.checkboxView.id, 'negative'),
        base_cb_size_s: find(v.checkboxSize.id, 's'),
        base_cb_size_m: find(v.checkboxSize.id, 'm'),
        base_cb_size_l: find(v.checkboxSize.id, 'l'),
        // Radiobox
        base_rb_view_accent: find(v.radioboxView.id, 'accent'),
        base_rb_view_negative: find(v.radioboxView.id, 'negative'),
        base_rb_size_s: find(v.radioboxSize.id, 's'),
        base_rb_size_m: find(v.radioboxSize.id, 'm'),
        base_rb_size_l: find(v.radioboxSize.id, 'l'),
        // Counter
        base_cou_size_l: find(v.counterSize.id, 'l'),
        base_cou_size_m: find(v.counterSize.id, 'm'),
        base_cou_size_S: find(v.counterSize.id, 'S'),
        base_cou_size_XS: find(v.counterSize.id, 'XS'),
        base_cou_size_XXS: find(v.counterSize.id, 'XXS'),
        base_cou_view_Accent: find(v.counterView.id, 'Accent'),
        base_cou_view_Positive: find(v.counterView.id, 'Positive'),
        base_cou_view_default: find(v.counterView.id, 'default'),
        base_cou_view_warning: find(v.counterView.id, 'warning'),
        base_cou_view_Negative: find(v.counterView.id, 'Negative'),
    };

    console.log(`  styles: ${rows.length} rows`);
    return s;
}
