import { sql } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedTenants(db: any, ctx: { designSystems: { base: any } }) {
    const { base } = ctx.designSystems;
    const colorConfig = {
        grayTone: 'warmGray',
        accentColor: 'arctic',
        light: { strokeSaturation: 700, fillSaturation: 600 },
        dark: { strokeSaturation: 400, fillSaturation: 400 },
    };
    const designSystemId = sql.identifier(schema.tenants.designSystemId.name);
    const name = sql.identifier(schema.tenants.name.name);
    const colorConfigColumn = sql.identifier(schema.tenants.colorConfig.name);
    const updatedAt = sql.identifier(schema.tenants.updatedAt.name);

    const [baseDefaultTenant] = await db.execute(sql`
        INSERT INTO ${schema.tenants} (
            ${designSystemId},
            ${name},
            ${colorConfigColumn}
        ) VALUES (
            ${base.id},
            ${'base_default'},
            ${JSON.stringify(colorConfig)}::jsonb
        )
        ON CONFLICT (${designSystemId}, lower(${name}))
        DO UPDATE SET
            ${colorConfigColumn} = excluded.color_config,
            ${updatedAt} = now()
        RETURNING *
    `);

    console.log(`  tenants: baseDefaultTenant(${baseDefaultTenant.id})`);
    return { baseDefaultTenant };
}
