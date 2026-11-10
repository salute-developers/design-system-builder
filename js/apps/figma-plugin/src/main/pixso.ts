import { applyExportPlan } from './applyExportPlan';
import { PIXSO_EDITOR, pixsoExportApi, type PixsoDocumentApi } from './pixsoExport';
import { startPlugin, type EditorApi } from './startPlugin';

declare const pixso: EditorApi & PixsoDocumentApi;

startPlugin(pixso, __html__, {
    name: PIXSO_EDITOR.name,
    applyExport: (plan) => applyExportPlan(plan, pixsoExportApi(pixso), PIXSO_EDITOR),
});
