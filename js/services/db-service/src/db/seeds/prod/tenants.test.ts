import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { designSystems, tenants } from '../../schema';
import { withRollback } from '../../../test/database';
import { seedTenants } from './tenants';

describe('seedTenants', () => {
    it('can seed the same design system twice without duplicating its case-insensitive tenant name', async () => {
        await withRollback(async (tx) => {
            const [base] = await tx
                .insert(designSystems)
                .values({ name: `seed-test-${crypto.randomUUID()}`, projectName: 'Seed test' })
                .returning();

            const first = await seedTenants(tx, { designSystems: { base } });
            const second = await seedTenants(tx, { designSystems: { base } });
            const rows = await tx.select().from(tenants).where(eq(tenants.designSystemId, base.id));

            expect(second.baseDefaultTenant.id).toBe(first.baseDefaultTenant.id);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ name: 'base_default', colorConfig: { accentColor: 'arctic' } });
        });
    });
});
