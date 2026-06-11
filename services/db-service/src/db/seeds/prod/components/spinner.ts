import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedSpinnerComponent(db: any) {
    const [spinner] = await db
        .insert(schema.components)
        .values([{ name: 'Spinner', description: 'Индикатор загрузки.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Spinner(${spinner.id})`);
    return spinner;
}
