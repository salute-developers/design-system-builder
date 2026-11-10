import type { ExportEditor, ExportFigmaApi } from './applyExportPlan';

/** Возможности Pixso по типам `@pixso/plugin-typings`: нет составного цвета и привязки стопов градиента. */
export const PIXSO_EDITOR: ExportEditor = { name: 'Pixso', composedColors: false, gradientStopBindings: false };

/** Часть API Pixso для записи плана: стили читаются только синхронно, остальное совпадает с Figma. */
export interface PixsoDocumentApi {
    variables: ExportFigmaApi['variables'];
    getLocalTextStyles(): TextStyle[];
    getLocalEffectStyles(): EffectStyle[];
    getLocalPaintStyles(): PaintStyle[];
    createTextStyle(): TextStyle;
    createEffectStyle(): EffectStyle;
    createPaintStyle(): PaintStyle;
    listAvailableFontsAsync(): Promise<Font[]>;
    loadFontAsync(font: FontName): Promise<void>;
}

/** Переходник к API записи плана: общий код записи не различает редакторы, кроме [PIXSO_EDITOR]. */
export const pixsoExportApi = (pixso: PixsoDocumentApi): ExportFigmaApi => ({
    variables: pixso.variables,
    getLocalTextStylesAsync: async () => pixso.getLocalTextStyles(),
    getLocalEffectStylesAsync: async () => pixso.getLocalEffectStyles(),
    getLocalPaintStylesAsync: async () => pixso.getLocalPaintStyles(),
    createTextStyle: () => pixso.createTextStyle(),
    createEffectStyle: () => pixso.createEffectStyle(),
    createPaintStyle: () => pixso.createPaintStyle(),
    listAvailableFontsAsync: () => pixso.listAvailableFontsAsync(),
    // Запись передаёт начертание всегда: `fontFor` возвращает имя целиком.
    loadFontAsync: (font) => pixso.loadFontAsync({ family: font.family, style: font.style ?? 'Regular' }),
});
