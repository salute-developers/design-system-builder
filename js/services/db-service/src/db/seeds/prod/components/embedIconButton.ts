import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedEmbedIconButtonComponent(db: any) {
    const [embedIconButton] = await db
        .insert(schema.components)
        .values([{ name: 'EmbedIconButton', description: 'Встраиваемая кнопка.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: EmbedIconButton(${embedIconButton.id})`);
    return embedIconButton;
}
