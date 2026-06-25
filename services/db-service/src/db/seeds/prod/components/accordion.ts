import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedAccordionComponent(db: any) {
    const [accordion] = await db
        .insert(schema.components)
        .values([{ name: 'Accordion', description: 'Компонент выпадающей информации.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Accordion(${accordion.id})`);
    return accordion;
}
