import { applyExportPlan } from './applyExportPlan';
import { startPlugin } from './startPlugin';

startPlugin(figma, __html__, (plan) => applyExportPlan(plan, figma));
