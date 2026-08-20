import * as schema from '../../schema';

// Variations are per-component and shared across design systems.
export async function seedVariations(
  db: any,
  ctx: {
    components: { button: any; text: any; link: any; textField: any; cell: any; cellLabel: any; cellTitle: any };
  },
) {
  const { button, text, link, textField, cell, cellLabel, cellTitle } = ctx.components;

  const rows = await db
    .insert(schema.variations)
    .values([
      // Button
      { componentId: button.id, name: 'View', description: 'Вид' },
      { componentId: button.id, name: 'Size', description: 'Размер' },
      { componentId: button.id, name: 'Shape', description: 'Форма' },
      // Text
      { componentId: text.id, name: 'Size', description: 'Размер' },
      // Link
      { componentId: link.id, name: 'View', description: 'Вид' },
      { componentId: link.id, name: 'Size', description: 'Размер' },
      // TextField
      { componentId: textField.id, name: 'View', description: 'Вид' },
      { componentId: textField.id, name: 'Size', description: 'Размер' },
      // Cell
      { componentId: cell.id, name: 'View', description: 'Вид' },
      { componentId: cell.id, name: 'Size', description: 'Размер' },
      // CellLabel
      { componentId: cellLabel.id, name: 'View', description: 'Вид' },
      { componentId: cellLabel.id, name: 'Size', description: 'Размер' },
      // CellTitle
      { componentId: cellTitle.id, name: 'View', description: 'Вид' },
      { componentId: cellTitle.id, name: 'Size', description: 'Размер' },
    ])
    .returning();

  const find = (compId: string, name: string) =>
    rows.find((r: any) => r.componentId === compId && r.name === name)!;

  const result = {
    buttonView: find(button.id, 'View'),
    buttonSize: find(button.id, 'Size'),
    buttonShape: find(button.id, 'Shape'),
    textSize: find(text.id, 'Size'),
    linkView: find(link.id, 'View'),
    linkSize: find(link.id, 'Size'),
    textFieldView: find(textField.id, 'View'),
    textFieldSize: find(textField.id, 'Size'),
    cellView: find(cell.id, 'View'),
    cellSize: find(cell.id, 'Size'),
    cellLabelView: find(cellLabel.id, 'View'),
    cellLabelSize: find(cellLabel.id, 'Size'),
    cellTitleView: find(cellTitle.id, 'View'),
    cellTitleSize: find(cellTitle.id, 'Size'),
  };

  console.log(`  variations: ${rows.length} rows`);
  return result;
}
