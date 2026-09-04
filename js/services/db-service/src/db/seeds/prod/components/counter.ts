import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedCounterComponent(db: any) {
    const [counter] = await db
        .insert(schema.components)
        .values([{ name: 'Counter', description: 'Счётчик.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Counter(${counter.id})`);
    return counter;
}
