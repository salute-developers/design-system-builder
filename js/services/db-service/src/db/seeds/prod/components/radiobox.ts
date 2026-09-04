import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedRadioboxComponent(db: any) {
    const [radiobox] = await db
        .insert(schema.components)
        .values([{ name: 'RadioBox', description: 'Переключатель (радиокнопка).' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: RadioBox(${radiobox.id})`);
    return radiobox;
}
