import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedIndicatorComponent(db: any) {
    const [indicator] = await db
        .insert(schema.components)
        .values([{ name: 'Indicator', description: 'Индикатор.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Indicator(${indicator.id})`);
    return indicator;
}
