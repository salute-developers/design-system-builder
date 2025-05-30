import { Router } from 'express';
import designSystemsRouter from './design-systems';
import componentsRouter from './components';
import variationsRouter from './variations';
import tokensRouter from './tokens';
import variationValuesRouter from './variation-values';

const router = Router();

// Mount routes
router.use('/design-systems', designSystemsRouter);
router.use('/components', componentsRouter);
router.use('/variations', variationsRouter);
router.use('/tokens', tokensRouter);
router.use('/variation-values', variationValuesRouter);

export default router; 