import { Router } from 'express';
import { createDesignSystemsRouter } from './api/design-systems';
import { createVariationValuesRouter } from './api/variation-values';
import { createComponentsRouter as createApiComponentsRouter } from './api/components';
import { createThemesRouter } from './api/themes';
import { createUsersRouter } from './api/users';
import { createComponentsRouter } from './admin-api/components';
import { createVariationsRouter } from './admin-api/variations';
import { createTokensRouter } from './admin-api/tokens';
import { createPropsAPIRouter } from './admin-api/props-api';
import { db } from '../db';

const router = Router();

const timeStart = new Date().toLocaleString();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    startedAt: timeStart,
  });
});

// Mount routes under 'api' namespace
router.use('/api/design-systems', createDesignSystemsRouter(db));
router.use('/api/variation-values', createVariationValuesRouter(db));
router.use('/api/components', createApiComponentsRouter(db));
router.use('/api/themes', createThemesRouter(db));
router.use('/api/users', createUsersRouter(db));

// Mount routes under 'admin-api' namespace
router.use('/admin-api/components', createComponentsRouter(db));
router.use('/admin-api/variations', createVariationsRouter(db));
router.use('/admin-api/tokens', createTokensRouter(db));
router.use('/admin-api/props-api', createPropsAPIRouter(db));

export default router;
