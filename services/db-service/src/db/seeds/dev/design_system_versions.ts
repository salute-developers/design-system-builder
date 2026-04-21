import { eq } from 'drizzle-orm';
import * as schema from '../../schema';

// Build a snapshot of the design system state.
function buildSnapshot(
  dsId: string,
  ctx: {
    tokens: { sdds: Record<string, any>; plasma: Record<string, any> };
    components: { button: any; text: any; link: any; textField: any };
    variations: Record<string, any>;
    styles: Record<string, any>;
    appearances: Record<string, any>;
    tenants: { sddsCe: any; sddsServ: any; plasmaWeb: any; plasmaGiga: any };
    designSystems: { sdds: any; plasma: any };
  },
) {
  const isSdds = dsId === ctx.designSystems.sdds.id;
  const tokenMap = isSdds ? ctx.tokens.sdds : ctx.tokens.plasma;
  const { button, text, link, textField } = ctx.components;
  const v = ctx.variations;
  const s = ctx.styles;
  const a = ctx.appearances;

  const compNames = isSdds
    ? ['Button', 'Text', 'Link', 'TextField']
    : ['Button', 'Text', 'Link'];
  const compMap: Record<string, any> = { Button: button, Text: text, Link: link, TextField: textField };

  const dsAppearances = isSdds
    ? [a.sdds_btn_default, a.sdds_btn_outline, a.sdds_txt_default, a.sdds_lnk_default, a.sdds_tf_default, a.sdds_tf_outline]
    : [a.plasma_btn_default, a.plasma_txt_default, a.plasma_lnk_default];

  const tenants = isSdds
    ? [ctx.tenants.sddsCe, ctx.tenants.sddsServ]
    : [ctx.tenants.plasmaWeb, ctx.tenants.plasmaGiga];

  const stylesForDs = Object.values(s).filter((style: any) => style.designSystemId === dsId);

  const variationNames: Record<string, string[]> = {
    Button: ['buttonView', 'buttonSize', 'buttonShape'],
    Text: ['textSize'],
    Link: ['linkView', 'linkSize'],
    TextField: ['textFieldView', 'textFieldSize'],
  };

  return {
    tokens: Object.values(tokenMap).map((t: any) => ({ id: t.id, name: t.name, type: t.type, enabled: t.enabled })),
    components: compNames.map((name) => {
      const comp = compMap[name];
      const varKeys = variationNames[name] ?? [];
      return {
        id: comp.id,
        name: comp.name,
        variations: varKeys.map((vk) => {
          const variation = v[vk];
          const varStyles = stylesForDs.filter((st: any) => st.variationId === variation.id);
          return {
            id: variation.id,
            name: variation.name,
            styles: varStyles.map((st: any) => st.name),
          };
        }),
      };
    }),
    appearances: dsAppearances.map((ap: any) => ({ id: ap.id, name: ap.name })),
    tenants: tenants.map((t: any) => ({ id: t.id, name: t.name })),
  };
}

// Step 1: Create stub versions (with empty snapshot) before seeding other data.
export async function seedDesignSystemVersions(
  db: any,
  ctx: {
    users: { neretin: any; client: any };
    designSystems: { sdds: any; plasma: any };
  },
) {
  const { neretin, client } = ctx.users;
  const { sdds, plasma } = ctx.designSystems;

  const rows = await db
    .insert(schema.designSystemVersions)
    .values([
      {
        designSystemId: sdds.id,
        userId: neretin.id,
        version: '0.1.0',
        snapshot: {},
        changelog: 'Первая дизайн система',
        publicationStatus: 'published',
      },
      {
        designSystemId: sdds.id,
        userId: client.id,
        version: '0.2.0',
        snapshot: {},
        changelog: 'Доработки по дизайн системе',
        publicationStatus: 'failed',
      },
      {
        designSystemId: plasma.id,
        userId: neretin.id,
        version: '0.1.0',
        snapshot: {},
        changelog: 'Первая дизайн система',
        publicationStatus: 'published',
      },
    ])
    .returning();

  const sddsFirst = rows.find((r: any) => r.designSystemId === sdds.id && r.version === '0.1.0')!;
  const sddsLast = rows.find((r: any) => r.designSystemId === sdds.id && r.version === '0.2.0')!;
  const plasmaLast = rows.find((r: any) => r.designSystemId === plasma.id)!;

  console.log(`  design_system_versions (stubs): ${rows.length} rows`);
  return { sddsFirst, sddsLast, plasmaLast };
}

// Step 2: Update version snapshots after all data is seeded.
export async function updateDesignSystemVersionSnapshots(
  db: any,
  ctx: {
    versions: { sddsFirst: any; sddsLast: any; plasmaLast: any };
    tokens: { sdds: Record<string, any>; plasma: Record<string, any> };
    components: { button: any; text: any; link: any; textField: any };
    variations: Record<string, any>;
    styles: Record<string, any>;
    appearances: Record<string, any>;
    tenants: { sddsCe: any; sddsServ: any; plasmaWeb: any; plasmaGiga: any };
    designSystems: { sdds: any; plasma: any };
  },
) {
  const { sdds, plasma } = ctx.designSystems;
  const { sddsFirst, sddsLast, plasmaLast } = ctx.versions;

  const sddsSnapshot = buildSnapshot(sdds.id, ctx);
  const plasmaSnapshot = buildSnapshot(plasma.id, ctx);

  await db
    .update(schema.designSystemVersions)
    .set({ snapshot: sddsSnapshot })
    .where(eq(schema.designSystemVersions.id, sddsFirst.id));

  await db
    .update(schema.designSystemVersions)
    .set({ snapshot: sddsSnapshot })
    .where(eq(schema.designSystemVersions.id, sddsLast.id));

  await db
    .update(schema.designSystemVersions)
    .set({ snapshot: plasmaSnapshot })
    .where(eq(schema.designSystemVersions.id, plasmaLast.id));

  console.log(`  design_system_versions snapshots: updated`);
}
