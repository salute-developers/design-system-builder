import * as schema from '../../../schema';

export async function seedRadioboxComponent(db: any) {
  const [radiobox] = await db
    .insert(schema.components)
    .values([
      { name: 'Radiobox', description: 'Переключатель (радиокнопка).' },
    ])
    .returning();

  console.log(`  components: Radiobox(${radiobox.id})`);
  return radiobox;
}
