import { Request, Router } from 'express';
import { and, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index';
import { designSystems, tenants, tokens, tokenValues } from '../../db/schema';
import { initializeTenantValues } from '../../db/initializers/design-system';
import { type ThemeColorConfig } from '../../domain/theme-profiles';
import { withThemePreviews } from '../../queries/theme-previews';
import {
    BatchSaveTenantTokenValuesSchema,
    CreateTenantSchema,
    UpdateTenantSchema,
    UuidParamSchema,
} from '../../validation/schema';
import { validateBody, validateParams } from '../../validation/middleware';
import { assertFound, getProjectId, isSystemAdmin, requireProjectRole, requireScope, tryCatch } from './utils';

const router = Router();
const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ');
const uniqueValueKey = (value: { tokenId: string; platform: string | null; mode: string | null }): string =>
    `${value.tokenId}:${value.platform ?? 'null'}:${value.mode ?? 'null'}`;
type BatchValue = {
    tokenId: string;
    platform: 'web' | 'ios' | 'android';
    mode: 'light' | 'dark' | null;
    paletteId?: string | null;
    value: unknown;
};
const tenantBelongsToProject = async (req: Request, tenantId: string): Promise<boolean> => {
    if (!getProjectId(req)) return true;
    const [row] = await db
        .select({ projectId: designSystems.projectId })
        .from(tenants)
        .innerJoin(designSystems, eq(tenants.designSystemId, designSystems.id))
        .where(eq(tenants.id, tenantId));
    return row?.projectId === getProjectId(req);
};

router.get('/', (req, res) =>
    tryCatch(res, async () => {
        const projectId = getProjectId(req);
        const rows = projectId
            ? await db
                  .select({ ...getTableColumns(tenants) })
                  .from(tenants)
                  .innerJoin(designSystems, eq(tenants.designSystemId, designSystems.id))
                  .where(eq(designSystems.projectId, projectId))
            : await db.select().from(tenants);
        res.json(await withThemePreviews(rows));
    }),
);

router.get('/:id', validateParams(UuidParamSchema), (req, res) =>
    tryCatch(res, async () => {
        if (!(await tenantBelongsToProject(req, req.params.id))) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const [row] = await db.select().from(tenants).where(eq(tenants.id, req.params.id));

        if (!assertFound(row, res)) {
            return;
        }

        res.json((await withThemePreviews([row]))[0]);
    }),
);

router.post('/', requireScope('tenants:write'), validateBody(CreateTenantSchema), (req, res) =>
    tryCatch(res, async () => {
        const projectId = getProjectId(req);
        if (projectId) {
            const [designSystem] = await db
                .select({ projectId: designSystems.projectId })
                .from(designSystems)
                .where(eq(designSystems.id, req.body.designSystemId));
            if (!designSystem || designSystem.projectId !== projectId) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            if (
                !isSystemAdmin(req) &&
                !['owner', 'maintainer', 'editor'].includes(String(req.headers['x-project-role'] || ''))
            ) {
                res.status(403).json({ error: 'Insufficient project role' });
                return;
            }
        }
        const colorConfig: ThemeColorConfig = {
            profile: req.body.profile,
            customPalette: req.body.customPalette && {
                primary: req.body.customPalette.primary.toUpperCase(),
                onPrimary: req.body.customPalette.onPrimary.toUpperCase(),
                background: req.body.customPalette.background.toUpperCase(),
                text: req.body.customPalette.text.toUpperCase(),
            },
        };
        try {
            const row = await db.transaction(async (tx) => {
                const [created] = await tx
                    .insert(tenants)
                    .values({
                        designSystemId: req.body.designSystemId,
                        name: normalizeName(req.body.name),
                        description: req.body.description,
                        colorConfig,
                    })
                    .returning();
                await initializeTenantValues(tx, created, colorConfig);
                return created;
            });
            res.status(201).json(row);
        } catch (error) {
            const details = String((error as { cause?: unknown }).cause ?? error);
            if (details.includes('tenants_design_system_id_name_ci_unique')) {
                res.status(409).json({ error: 'Theme name already exists', code: 'TENANT_NAME_CONFLICT' });
                return;
            }
            throw error;
        }
    }),
);

router.patch(
    '/:id',
    requireScope('tenants:write'),
    requireProjectRole(['owner', 'maintainer', 'editor']),
    validateParams(UuidParamSchema),
    validateBody(UpdateTenantSchema),
    (req, res) =>
        tryCatch(res, async () => {
            if (!(await tenantBelongsToProject(req, req.params.id))) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            let row: typeof tenants.$inferSelect | undefined;
            try {
                [row] = await db
                    .update(tenants)
                    .set({ ...req.body, name: req.body.name ? normalizeName(req.body.name) : undefined })
                    .where(eq(tenants.id, req.params.id))
                    .returning();
            } catch (error) {
                const details = String((error as { cause?: unknown }).cause ?? error);
                if (details.includes('tenants_design_system_id_name_ci_unique')) {
                    res.status(409).json({ error: 'Theme name already exists', code: 'TENANT_NAME_CONFLICT' });
                    return;
                }
                throw error;
            }

            if (!assertFound(row, res)) {
                return;
            }

            res.json(row);
        }),
);

router.delete(
    '/:id',
    requireScope('tenants:delete'),
    requireProjectRole(['owner', 'maintainer']),
    validateParams(UuidParamSchema),
    (req, res) =>
        tryCatch(res, async () => {
            if (!(await tenantBelongsToProject(req, req.params.id))) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            const [row] = await db.delete(tenants).where(eq(tenants.id, req.params.id)).returning();

            if (!assertFound(row, res)) {
                return;
            }

            res.json({ ok: true });
        }),
);

// GET /tenants/:id/token-values — all token values for a tenant
router.get('/:id/token-values', validateParams(UuidParamSchema), (req, res) =>
    tryCatch(res, async () => {
        if (!(await tenantBelongsToProject(req, req.params.id))) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const rows = await db.select().from(tokenValues).where(eq(tokenValues.tenantId, req.params.id));
        res.json(rows);
    }),
);

router.put(
    '/:id/token-values',
    requireScope('tenants:write'),
    requireProjectRole(['owner', 'maintainer', 'editor']),
    validateParams(UuidParamSchema),
    validateBody(BatchSaveTenantTokenValuesSchema),
    (req, res) =>
        tryCatch(res, async () => {
            if (!(await tenantBelongsToProject(req, req.params.id))) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            const keys = req.body.values.map(uniqueValueKey);
            if (new Set(keys).size !== keys.length) {
                res.status(400).json({ error: 'Duplicate token/platform/mode combination' });
                return;
            }

            const outcome = await db.transaction(async (tx) => {
                await tx.execute(sql`select id from ${tenants} where ${tenants.id} = ${req.params.id} for update`);
                const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, req.params.id));
                if (!tenant) return { status: 'missing' as const };
                if (tenant.editRevision !== req.body.editRevision) {
                    return { status: 'conflict' as const, editRevision: tenant.editRevision };
                }

                const tokenIds: string[] = Array.from(
                    new Set<string>(req.body.values.map((value: { tokenId: string }) => value.tokenId)),
                );
                if (tokenIds.length > 0) {
                    const validTokens = await tx
                        .select({ id: tokens.id })
                        .from(tokens)
                        .where(and(eq(tokens.designSystemId, tenant.designSystemId), inArray(tokens.id, tokenIds)));
                    if (validTokens.length !== tokenIds.length) return { status: 'invalid' as const };
                }

                await tx
                    .delete(tokenValues)
                    .where(
                        and(
                            eq(tokenValues.tenantId, tenant.id),
                            inArray(tokenValues.platform, ['web', 'ios', 'android']),
                        ),
                    );
                if (req.body.values.length > 0) {
                    await tx.insert(tokenValues).values(
                        req.body.values.map((value: BatchValue) => ({
                            ...value,
                            tenantId: tenant.id,
                            paletteId: value.paletteId ?? null,
                        })),
                    );
                }
                const [updated] = await tx
                    .update(tenants)
                    .set({ editRevision: tenant.editRevision + 1 })
                    .where(eq(tenants.id, tenant.id))
                    .returning({ editRevision: tenants.editRevision });
                return { status: 'saved' as const, editRevision: updated.editRevision };
            });

            if (outcome.status === 'missing') return void res.status(404).json({ error: 'Not found' });
            if (outcome.status === 'invalid')
                return void res.status(400).json({ error: 'Token does not belong to tenant design system' });
            if (outcome.status === 'conflict') {
                return void res.status(409).json({
                    error: 'Tenant was modified by another editor',
                    code: 'TENANT_EDIT_CONFLICT',
                    editRevision: outcome.editRevision,
                });
            }
            res.json({ editRevision: outcome.editRevision });
        }),
);

export default router;
