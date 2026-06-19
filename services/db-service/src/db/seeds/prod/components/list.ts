import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedListComponent(db: any) {
    const [list] = await db
        .insert(schema.components)
        .values([{ name: 'List', description: 'Список.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: List(${list.id})`);
    return list;
}
