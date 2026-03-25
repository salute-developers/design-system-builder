import * as schema from '../../schema';

export async function seedAppearances(
  db: any,
  ctx: {
    designSystems: { plasmaTest: any };
    components: { iconButton: any; button: any; link: any; checkbox: any; radiobox: any };
  },
) {
  const { plasmaTest } = ctx.designSystems;
  const { iconButton, button, link, checkbox, radiobox } = ctx.components;

  const rows = await db
    .insert(schema.appearances)
    .values([
      { designSystemId: plasmaTest.id, componentId: iconButton.id, name: 'default' },
      { designSystemId: plasmaTest.id, componentId: button.id, name: 'default' },
      { designSystemId: plasmaTest.id, componentId: link.id, name: 'default' },
      { designSystemId: plasmaTest.id, componentId: checkbox.id, name: 'default' },
      { designSystemId: plasmaTest.id, componentId: radiobox.id, name: 'default' },
    ])
    .returning();

  const findByComp = (compId: string) => rows.find((r: any) => r.componentId === compId)!;

  const a = {
    plasmaTest_ib_default: findByComp(iconButton.id),
    plasmaTest_btn_default: findByComp(button.id),
    plasmaTest_link_default: findByComp(link.id),
    plasmaTest_cb_default: findByComp(checkbox.id),
    plasmaTest_rb_default: findByComp(radiobox.id),
  };

  console.log(`  appearances: ${rows.length} rows`);
  return a;
}
