import * as schema from '../../schema';

export async function seedDesignSystemComponents(
  db: any,
  ctx: {
    designSystems: { plasmaTest: any };
    components: { iconButton: any; button: any; link: any; checkbox: any; radiobox: any };
  },
) {
  const { plasmaTest } = ctx.designSystems;
  const { iconButton, button, link, checkbox, radiobox } = ctx.components;

  const rows = await db
    .insert(schema.designSystemComponents)
    .values([
      { designSystemId: plasmaTest.id, componentId: iconButton.id },
      { designSystemId: plasmaTest.id, componentId: button.id },
      { designSystemId: plasmaTest.id, componentId: link.id },
      { designSystemId: plasmaTest.id, componentId: checkbox.id },
      { designSystemId: plasmaTest.id, componentId: radiobox.id },
    ])
    .returning();

  console.log(`  design_system_components: ${rows.length} rows`);
}
