import * as schema from '../../schema';

export async function seedDocumentationPages(
  db: any,
  ctx: { designSystems: { sdds: any; plasma: any } },
) {
  const { sdds, plasma } = ctx.designSystems;

  const rows = await db
    .insert(schema.documentationPages)
    .values([
      {
        designSystemId: sdds.id,
        content: 'Это контент для странички с документацией для дизайн системы SDDS',
      },
      {
        designSystemId: plasma.id,
        content: 'Это контент для странички с документацией для дизайн системы PLASMA',
      },
    ])
    .returning();

  console.log(`  documentation_pages: ${rows.length} rows`);
  return rows;
}
