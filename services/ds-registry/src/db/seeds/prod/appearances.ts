import * as schema from '../../schema';

export async function seedAppearances(
  db: any,
  ctx: {
    designSystems: { base: any };
    components: { iconButton: any; button: any; link: any; checkbox: any; radiobox: any };
  },
) {
  const { base } = ctx.designSystems;
  const { iconButton, button, link, checkbox, radiobox } = ctx.components;

  const rows = await db
    .insert(schema.appearances)
    .values([
      { designSystemId: base.id, componentId: iconButton.id, name: 'default' },
      { designSystemId: base.id, componentId: button.id, name: 'default' },
      { designSystemId: base.id, componentId: link.id, name: 'default' },
      { designSystemId: base.id, componentId: checkbox.id, name: 'default' },
      { designSystemId: base.id, componentId: radiobox.id, name: 'default' },
    ])
    .returning();

  const findByComp = (compId: string) => rows.find((r: any) => r.componentId === compId)!;

  const a = {
    base_ib_default: findByComp(iconButton.id),
    base_btn_default: findByComp(button.id),
    base_link_default: findByComp(link.id),
    base_cb_default: findByComp(checkbox.id),
    base_rb_default: findByComp(radiobox.id),
  };

  console.log(`  appearances: ${rows.length} rows`);
  return a;
}
