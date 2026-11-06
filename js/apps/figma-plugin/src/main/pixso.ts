import { startPlugin, type EditorApi } from './startPlugin';

declare const pixso: EditorApi;

startPlugin(pixso, __html__);
