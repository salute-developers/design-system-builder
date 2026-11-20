/**
 * Редактор, в котором открыт плагин, и его возможности, которых нет в общем API. Figma поддерживает всё; Pixso не
 * умеет ссылку на цвет с прозрачностью и привязку стопов градиента (проверено в Pixso 2.3).
 */
export interface ExportEditor {
    name: string;
    composedColors: boolean;
    gradientStopBindings: boolean;
}

export const FIGMA_EDITOR: ExportEditor = { name: 'Figma', composedColors: true, gradientStopBindings: true };

export const PIXSO_EDITOR: ExportEditor = { name: 'Pixso', composedColors: false, gradientStopBindings: false };
