import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedLinkButtonComponent(db: any) {
    const [linkButton] = await db
        .insert(schema.components)
        .values([{ name: 'LinkButton', description: 'Кнопка-ссылка.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: LinkButton(${linkButton.id})`);
    return linkButton;
}
