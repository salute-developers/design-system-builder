import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedIconButtonComponent(db: any) {
    const [iconButton] = await db
        .insert(schema.components)
        .values([{ name: 'IconButton', description: 'Кнопка с иконкой.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: IconButton(${iconButton.id})`);
    return iconButton;
}
