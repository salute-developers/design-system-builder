import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedCellComponent(db: any) {
    const [cell] = await db
        .insert(schema.components)
        .values([{ name: 'Cell', description: 'Ячейка.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Cell(${cell.id})`);
    return cell;
}
