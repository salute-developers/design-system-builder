import { Router } from 'express';
import { createDesignSystemsRouter } from './api/design-systems';
import { createVariationValuesRouter } from './api/variation-values';
import { createComponentsRouter as createApiComponentsRouter } from './api/components';
import { createComponentsRouter } from './admin-api/components';
import { createVariationsRouter } from './admin-api/variations';
import { createTokensRouter } from './admin-api/tokens';
import { db } from '../db';

const router = Router();

// Health check endpoint
router.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount routes under 'api' namespace
router.use('/api/design-systems', createDesignSystemsRouter(db));
router.use('/api/variation-values', createVariationValuesRouter(db));
router.use('/api/components', createApiComponentsRouter(db));

// Mount routes under 'admin-api' namespace
router.use('/admin-api/components', createComponentsRouter(db));
router.use('/admin-api/variations', createVariationsRouter(db));
router.use('/admin-api/tokens', createTokensRouter(db));

export default router; 