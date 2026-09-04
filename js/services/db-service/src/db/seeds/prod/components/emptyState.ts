import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedEmptyStateComponent(db: any) {
    const [emptyState] = await db
        .insert(schema.components)
        .values([{ name: 'EmptyState', description: 'Компонент для вставки.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: EmptyState(${emptyState.id})`);
    return emptyState;
}
