import { applyExportPlan, FIGMA_EDITOR } from './applyExportPlan';
import { startPlugin } from './startPlugin';

startPlugin(figma, __html__, { name: FIGMA_EDITOR.name, applyExport: (plan) => applyExportPlan(plan, figma) });
