import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedButtonComponent(db: any) {
    const [button] = await db
        .insert(schema.components)
        .values([{ name: 'Button', description: 'Кнопка.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Button(${button.id})`);
    return button;
}
