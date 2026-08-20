import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedChipComponent(db: any) {
    const [chip] = await db
        .insert(schema.components)
        .values([{ name: 'Chip', description: 'Чип.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Chip(${chip.id})`);
    return chip;
}
