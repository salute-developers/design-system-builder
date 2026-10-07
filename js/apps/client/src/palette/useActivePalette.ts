import { useSyncExternalStore } from 'react';

import { getActivePalette, subscribeActivePalette } from './activePalette';

/** Палитра открытой темы; компонент перерисовывается при её смене. */
export const useActivePalette = () => useSyncExternalStore(subscribeActivePalette, getActivePalette, getActivePalette);
