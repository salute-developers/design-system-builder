import { FIGMA_EDITOR } from '../shared/editor';
import { applyExportPlan } from './applyExportPlan';
import { startPlugin } from './startPlugin';

startPlugin(figma, __html__, { editor: FIGMA_EDITOR, applyExport: (plan) => applyExportPlan(plan, figma) });
