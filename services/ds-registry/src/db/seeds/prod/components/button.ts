import * as schema from '../../../schema';

export async function seedButtonComponent(db: any) {
  const [button] = await db
    .insert(schema.components)
    .values([
      { name: 'Button', description: 'Кнопка.' },
    ])
    .returning();

  console.log(`  components: Button(${button.id})`);
  return button;
}
