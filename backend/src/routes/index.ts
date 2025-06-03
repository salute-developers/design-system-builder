import { Router } from 'express';
import designSystemsRouter from './api/design-systems';
import variationValuesRouter from './api/variation-values';
import componentsRouter from './admin-api/components';
import variationsRouter from './admin-api/variations';
import tokensRouter from './admin-api/tokens';

const router = Router();

// Mount routes under 'api' namespace
router.use('/api/design-systems', designSystemsRouter);
router.use('/api/variation-values', variationValuesRouter);

// Mount routes under 'admin-api' namespace
router.use('/admin-api/components', componentsRouter);
router.use('/admin-api/variations', variationsRouter);
router.use('/admin-api/tokens', tokensRouter);

export default router; 