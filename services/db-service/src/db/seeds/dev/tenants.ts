import * as schema from '../../schema';

export async function seedTenants(
  db: any,
  ctx: {
    designSystems: { sdds: any; plasma: any };
  },
) {
  const { sdds, plasma } = ctx.designSystems;

  const rows = await db
    .insert(schema.tenants)
    .values([
      {
        designSystemId: sdds.id,
        name: 'sdds_cs',
        description: 'SDDS для потребительских устройств (смартфоны, планшеты)',
        colorConfig: {
          grayTone: 'coolGray',
          accentColor: 'green',
          light: { strokeSaturation: 500, fillSaturation: 400 },
          dark: { strokeSaturation: 500, fillSaturation: 500 },
        },
      },
      {
        designSystemId: sdds.id,
        name: 'sdds_serv',
        description: 'SDDS для сервисных и бизнес-приложений',
        colorConfig: {
          grayTone: 'gray',
          accentColor: 'blue',
          light: { strokeSaturation: 500, fillSaturation: 400 },
          dark: { strokeSaturation: 500, fillSaturation: 500 },
        },
      },
      {
        designSystemId: plasma.id,
        name: 'plasma_web',
        description: 'Plasma для веб-приложений и браузерных интерфейсов',
        colorConfig: {
          grayTone: 'coolGray',
          accentColor: 'red',
          light: { strokeSaturation: 500, fillSaturation: 400 },
          dark: { strokeSaturation: 500, fillSaturation: 500 },
        },
      },
      {
        designSystemId: plasma.id,
        name: 'plasma_giga',
        description: 'Plasma для устройств GigaChat и умных колонок',
        colorConfig: {
          grayTone: 'warmGray',
          accentColor: 'pink',
          light: { strokeSaturation: 500, fillSaturation: 400 },
          dark: { strokeSaturation: 500, fillSaturation: 500 },
        },
      },
    ])
    .returning();

  const sddsCe = rows.find((r: any) => r.name === 'sdds_cs')!;
  const sddsServ = rows.find((r: any) => r.name === 'sdds_serv')!;
  const plasmaWeb = rows.find((r: any) => r.name === 'plasma_web')!;
  const plasmaGiga = rows.find((r: any) => r.name === 'plasma_giga')!;

  console.log(
    `  tenants: sddsCe(${sddsCe.id}), sddsServ(${sddsServ.id}), plasmaWeb(${plasmaWeb.id}), plasmaGiga(${plasmaGiga.id})`,
  );
  return { sddsCe, sddsServ, plasmaWeb, plasmaGiga };
}
