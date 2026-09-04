import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedSwitchComponent(db: any) {
    const [switchComponent] = await db
        .insert(schema.components)
        .values([{ name: 'Switch', description: 'Переключатель.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Switch(${switchComponent.id})`);
    return switchComponent;
}
