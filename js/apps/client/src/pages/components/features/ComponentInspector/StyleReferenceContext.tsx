import { createContext, useContext } from 'react';

import type { DesignSystem } from '../../../../controllers';

/** Что нужно строке со ссылкой на стиль: данные дизайн-системы и догрузка конфигурации выбранной цели. */
export interface StyleReferenceAccess {
    designSystem: DesignSystem;
    /** Догружает компонент по маршруту (`compose-<имя>`); после неё `designSystem` приходит обновлённым. */
    loadComponent?: (route: string) => Promise<void>;
}

export const StyleReferenceContext = createContext<StyleReferenceAccess | undefined>(undefined);

export const useStyleReferenceAccess = () => useContext(StyleReferenceContext);
