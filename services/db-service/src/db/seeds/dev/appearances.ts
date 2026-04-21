import * as schema from '../../schema';

// Each component in each design system has its own set of appearances.
// SDDS Button: default, outline
// SDDS Text: default
// SDDS Link: default
// SDDS TextField: default, outline
// SDDS Cell: default
// SDDS CellLabel: default
// SDDS CellTitle: default
// PLASMA Button: default
// PLASMA Text: default
// PLASMA Link: default
export async function seedAppearances(
  db: any,
  ctx: {
    designSystems: { sdds: any; plasma: any };
    components: { button: any; text: any; link: any; textField: any; cell: any; cellLabel: any; cellTitle: any };
  },
) {
  const { sdds, plasma } = ctx.designSystems;
  const { button, text, link, textField, cell, cellLabel, cellTitle } = ctx.components;

  const rows = await db
    .insert(schema.appearances)
    .values([
      // SDDS Button
      { designSystemId: sdds.id, componentId: button.id, name: 'default' },
      { designSystemId: sdds.id, componentId: button.id, name: 'outline' },
      // SDDS Text
      { designSystemId: sdds.id, componentId: text.id, name: 'default' },
      // SDDS Link
      { designSystemId: sdds.id, componentId: link.id, name: 'default' },
      // SDDS TextField
      { designSystemId: sdds.id, componentId: textField.id, name: 'default' },
      { designSystemId: sdds.id, componentId: textField.id, name: 'outline' },
      // SDDS Cell
      { designSystemId: sdds.id, componentId: cell.id, name: 'default' },
      // SDDS CellLabel
      { designSystemId: sdds.id, componentId: cellLabel.id, name: 'default' },
      // SDDS CellTitle
      { designSystemId: sdds.id, componentId: cellTitle.id, name: 'default' },
      // PLASMA Button
      { designSystemId: plasma.id, componentId: button.id, name: 'default' },
      // PLASMA Text
      { designSystemId: plasma.id, componentId: text.id, name: 'default' },
      // PLASMA Link
      { designSystemId: plasma.id, componentId: link.id, name: 'default' },
    ])
    .returning();

  const find = (dsId: string, compId: string, name: string) =>
    rows.find((r: any) => r.designSystemId === dsId && r.componentId === compId && r.name === name)!;

  const result = {
    sdds_btn_default: find(sdds.id, button.id, 'default'),
    sdds_btn_outline: find(sdds.id, button.id, 'outline'),
    sdds_txt_default: find(sdds.id, text.id, 'default'),
    sdds_lnk_default: find(sdds.id, link.id, 'default'),
    sdds_tf_default: find(sdds.id, textField.id, 'default'),
    sdds_tf_outline: find(sdds.id, textField.id, 'outline'),
    sdds_cell_default: find(sdds.id, cell.id, 'default'),
    sdds_cl_default: find(sdds.id, cellLabel.id, 'default'),
    sdds_ct_default: find(sdds.id, cellTitle.id, 'default'),
    plasma_btn_default: find(plasma.id, button.id, 'default'),
    plasma_txt_default: find(plasma.id, text.id, 'default'),
    plasma_lnk_default: find(plasma.id, link.id, 'default'),
  };

  console.log(`  appearances: ${rows.length} rows (per component per DS)`);
  return result;
}
