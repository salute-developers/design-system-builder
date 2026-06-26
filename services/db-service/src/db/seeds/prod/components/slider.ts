import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedSliderComponent(db: any) {
    const [slider] = await db
        .insert(schema.components)
        .values([{ name: 'Slider', description: 'Слайдер.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Slider(${slider.id})`);
    return slider;
}
