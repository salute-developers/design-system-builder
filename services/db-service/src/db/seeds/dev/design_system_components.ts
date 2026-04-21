import * as schema from '../../schema';

// SDDS: Button, Text, Link, TextField, Cell, CellLabel, CellTitle
// PLASMA: Button, Text, Link
export async function seedDesignSystemComponents(
  db: any,
  ctx: {
    designSystems: { sdds: any; plasma: any };
    components: { button: any; text: any; link: any; textField: any; cell: any; cellLabel: any; cellTitle: any };
  },
) {
  const { sdds, plasma } = ctx.designSystems;
  const { button, text, link, textField, cell, cellLabel, cellTitle } = ctx.components;

  const rows = await db
    .insert(schema.designSystemComponents)
    .values([
      { designSystemId: sdds.id, componentId: button.id },
      { designSystemId: sdds.id, componentId: text.id },
      { designSystemId: sdds.id, componentId: link.id },
      { designSystemId: sdds.id, componentId: textField.id },
      { designSystemId: sdds.id, componentId: cell.id },
      { designSystemId: sdds.id, componentId: cellLabel.id },
      { designSystemId: sdds.id, componentId: cellTitle.id },
      { designSystemId: plasma.id, componentId: button.id },
      { designSystemId: plasma.id, componentId: text.id },
      { designSystemId: plasma.id, componentId: link.id },
    ])
    .returning();

  console.log(`  design_system_components: ${rows.length} rows`);
  return rows;
}
