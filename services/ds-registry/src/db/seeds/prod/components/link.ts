import * as schema from '../../../schema';

export async function seedLinkComponent(db: any) {
  const [link] = await db
    .insert(schema.components)
    .values([
      { name: 'Link', description: 'Ссылка.' },
    ])
    .returning();

  console.log(`  components: Link(${link.id})`);
  return link;
}
