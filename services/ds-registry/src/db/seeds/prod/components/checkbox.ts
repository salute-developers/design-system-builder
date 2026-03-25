import * as schema from '../../../schema';

export async function seedCheckboxComponent(db: any) {
  const [checkbox] = await db
    .insert(schema.components)
    .values([
      { name: 'Checkbox', description: 'Чекбокс.' },
    ])
    .returning();

  console.log(`  components: Checkbox(${checkbox.id})`);
  return checkbox;
}
