import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedNoteComponent(db: any) {
    const [note] = await db
        .insert(schema.components)
        .values([{ name: 'Note', description: 'Компонент для подсказок.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Note(${note.id})`);
    return note;
}
