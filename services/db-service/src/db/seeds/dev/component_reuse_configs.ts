import * as schema from '../../schema';

// TextField reuses Text in SDDS with appearance=default, variation=Size, style=S
export async function seedComponentReuseConfigs(
  db: any,
  ctx: {
    designSystems: { sdds: any };
    componentDeps: { textField_text: any };
    appearances: { sdds_txt_default: any };
    variations: { textSize: any };
    styles: { sdds_txt_size_s: any };
  },
) {
  const rows = await db
    .insert(schema.componentReuseConfigs)
    .values([
      {
        componentDepId: ctx.componentDeps.textField_text.id,
        designSystemId: ctx.designSystems.sdds.id,
        appearanceId: ctx.appearances.sdds_txt_default.id,
        variationId: ctx.variations.textSize.id,
        styleId: ctx.styles.sdds_txt_size_s.id,
      },
    ])
    .returning();

  console.log(`  component_reuse_configs: ${rows.length} rows`);
  return rows;
}
