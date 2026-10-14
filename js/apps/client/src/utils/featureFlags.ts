/**
 * Раздел «Компоненты» редактора. Задаётся при сборке переменной `VITE_COMPONENT_EDITOR_ENABLED`: `true` включает,
 * любое другое значение выключает. Без значения раздел включён в dev-сервере (`vite dev`) и выключен в production-сборке.
 * Значение читается при каждом вызове, чтобы тесты могли его подменять (`vi.stubEnv`).
 */
export const isComponentEditorEnabled = (): boolean => {
    const value = import.meta.env.VITE_COMPONENT_EDITOR_ENABLED;

    return value === undefined ? import.meta.env.DEV : value === 'true';
};
