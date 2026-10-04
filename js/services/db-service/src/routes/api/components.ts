import { Router } from 'express';
import { eq, getTableColumns } from 'drizzle-orm';
import { db } from '../../db/index';
import {
    components,
    designSystemComponents,
    designSystems,
    variations,
    properties,
    componentDeps,
} from '../../db/schema';
import { CreateComponentSchema, UpdateComponentSchema, UuidParamSchema } from '../../validation/schema';
import { validateBody, validateParams } from '../../validation/middleware';
import { andOptional, assertFound, designSystemScopeFilter, getProjectId, requireScope, tryCatch } from './utils';

const router = Router();
const READ_SCOPE = 'components:read';

const hasComponentAccess = async (
    componentId: string,
    req: Parameters<typeof designSystemScopeFilter>[0],
): Promise<boolean> => {
    if (!getProjectId(req)) return true;
    const [association] = await db
        .select({ componentId: designSystemComponents.componentId })
        .from(designSystemComponents)
        .innerJoin(designSystems, eq(designSystemComponents.designSystemId, designSystems.id))
        .where(andOptional(eq(designSystemComponents.componentId, componentId), designSystemScopeFilter(req)));
    return Boolean(association);
};

router.get('/', (req, res) =>
    tryCatch(res, async () => {
        const projectId = getProjectId(req);
        const rows = projectId
            ? await db
                  .selectDistinct({ ...getTableColumns(components) })
                  .from(components)
                  .innerJoin(designSystemComponents, eq(components.id, designSystemComponents.componentId))
                  .innerJoin(designSystems, eq(designSystemComponents.designSystemId, designSystems.id))
                  .where(eq(designSystems.projectId, projectId))
            : await db.select().from(components);
        res.json(rows);
    }),
);

router.get('/:id', requireScope(READ_SCOPE), validateParams(UuidParamSchema), (req, res) =>
    tryCatch(res, async () => {
        const [row] = await db.select().from(components).where(eq(components.id, req.params.id));

        if (!assertFound(row, res) || !(await hasComponentAccess(row.id, req))) {
            if (row) res.status(404).json({ error: 'Not found' });
            return;
        }

        res.json(row);
    }),
);

router.post('/', validateBody(CreateComponentSchema), (req, res) =>
    tryCatch(res, async () => {
        const [row] = await db.insert(components).values(req.body).returning();
        res.status(201).json(row);
    }),
);

router.patch('/:id', validateParams(UuidParamSchema), validateBody(UpdateComponentSchema), (req, res) =>
    tryCatch(res, async () => {
        if (!(await hasComponentAccess(req.params.id, req))) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const [row] = await db.update(components).set(req.body).where(eq(components.id, req.params.id)).returning();

        if (!assertFound(row, res)) {
            return;
        }

        res.json(row);
    }),
);

router.delete('/:id', validateParams(UuidParamSchema), (req, res) =>
    tryCatch(res, async () => {
        if (!(await hasComponentAccess(req.params.id, req))) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const [row] = await db.delete(components).where(eq(components.id, req.params.id)).returning();

        if (!assertFound(row, res)) {
            return;
        }

        res.json({ ok: true });
    }),
);

// GET /components/:id/variations
router.get('/:id/variations', requireScope(READ_SCOPE), validateParams(UuidParamSchema), (req, res) =>
    tryCatch(res, async () => {
        if (!(await hasComponentAccess(req.params.id, req))) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const rows = await db.select().from(variations).where(eq(variations.componentId, req.params.id));
        res.json(rows);
    }),
);

// GET /components/:id/properties
router.get('/:id/properties', validateParams(UuidParamSchema), (req, res) =>
    tryCatch(res, async () => {
        if (!(await hasComponentAccess(req.params.id, req))) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const rows = await db.select().from(properties).where(eq(properties.componentId, req.params.id));
        res.json(rows);
    }),
);

// GET /components/:id/deps — parent and child deps
router.get('/:id/deps', validateParams(UuidParamSchema), (req, res) =>
    tryCatch(res, async () => {
        if (!(await hasComponentAccess(req.params.id, req))) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const asParent = await db.query.componentDeps.findMany({
            where: eq(componentDeps.parentId, req.params.id),
            with: { child: true },
        });
        const asChild = await db.query.componentDeps.findMany({
            where: eq(componentDeps.childId, req.params.id),
            with: { parent: true },
        });
        res.json({ asParent, asChild });
    }),
);

export default router;
