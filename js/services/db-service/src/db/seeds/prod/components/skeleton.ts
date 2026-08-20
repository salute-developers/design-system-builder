import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seedSkeletonComponent(db: any) {
    const [skeleton] = await db
        .insert(schema.components)
        .values([{ name: 'Skeleton', description: 'Компонент загрузки.' }])
        .onConflictDoUpdate({
            target: schema.components.name,
            set: { description: sql`excluded.description` },
        })
        .returning();

    console.log(`  components: Skeleton(${skeleton.id})`);
    return skeleton;
}
