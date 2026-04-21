import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedLinkComponent(db: any) {
    const [link] = await db
        .insert(schema.components)
        .values([{ name: 'Link', description: 'Ссылка.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Link(${link.id})`);
    return link;
}
