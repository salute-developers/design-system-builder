import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedTextFieldComponent(db: any) {
    const [textField] = await db
        .insert(schema.components)
        .values([{ name: 'TextField', description: 'Текстовое поле.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: TextField(${textField.id})`);
    return textField;
}
