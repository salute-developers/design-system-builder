import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedBadgeComponent(db: any) {
    const [badge] = await db
        .insert(schema.components)
        .values([{ name: 'Badge', description: 'Бейдж.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Badge(${badge.id})`);
    return badge;
}
