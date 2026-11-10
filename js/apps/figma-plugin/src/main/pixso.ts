import { PIXSO_EDITOR } from '../shared/editor';
import { applyPixsoExport, type PixsoDocumentApi } from './pixsoExport';
import { startPlugin, type EditorApi } from './startPlugin';

declare const pixso: EditorApi & PixsoDocumentApi;

startPlugin(pixso, __html__, { editor: PIXSO_EDITOR, applyExport: (plan) => applyPixsoExport(plan, pixso) });
