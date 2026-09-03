import * as schema from '../../schema';

// Link depends on Text, TextField depends on Text
// Cell composes CellLabel and CellTitle
export async function seedComponentDeps(
  db: any,
  ctx: { components: { link: any; textField: any; text: any; cell: any; cellLabel: any; cellTitle: any } },
) {
  const { link, textField, text, cell, cellLabel, cellTitle } = ctx.components;

  const rows = await db
    .insert(schema.componentDeps)
    .values([
      { parentId: link.id, childId: text.id, type: 'reuse' as const, order: 1 },
      { parentId: textField.id, childId: text.id, type: 'reuse' as const, order: 1 },
      { parentId: cell.id, childId: cellLabel.id, type: 'compose' as const, order: 1 },
      { parentId: cell.id, childId: cellTitle.id, type: 'compose' as const, order: 2 },
    ])
    .returning();

  const find = (pId: string, cId: string) =>
    rows.find((r: any) => r.parentId === pId && r.childId === cId)!;

  const result = {
    link_text: find(link.id, text.id),
    textField_text: find(textField.id, text.id),
    cell_cellLabel: find(cell.id, cellLabel.id),
    cell_cellTitle: find(cell.id, cellTitle.id),
  };

  console.log(`  component_deps: ${rows.length} rows`);
  return result;
}
