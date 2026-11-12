/** Ширины панелей раздела компонентов: их берут и раздел, и скелетоны загрузки, чтобы раскладка не прыгала. */
export const COMPONENTS_PANEL = { storageKey: 'ds_components_panel', limits: { min: 220, max: 320, initial: 280 } };

export const INSPECTOR_PANEL = {
    storageKey: 'ds_components_panel',
    side: 'right' as const,
    limits: { min: 280, max: 560, initial: 440 },
};
