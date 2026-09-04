import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedDividerComponent(db: any) {
    const [divider] = await db
        .insert(schema.components)
        .values([{ name: 'Divider', description: 'Разделитель.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Divider(${divider.id})`);
    return divider;
}
