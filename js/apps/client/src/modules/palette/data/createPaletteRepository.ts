import type { PaletteRepository } from '../application/paletteRepository';
import { createHttpPaletteRepository } from './httpPaletteRepository';
import { createLocalPaletteRepository, type LocalPaletteDeps } from './localPaletteRepository';

export type PaletteSource = 'api' | 'local';

/** Источник палитры из `VITE_PALETTE_SOURCE`; до слияния сервера по умолчанию `local`. */
export const paletteSourceFromEnv = (value: string | undefined = import.meta.env.VITE_PALETTE_SOURCE): PaletteSource =>
    value === 'api' ? 'api' : 'local';

export const createPaletteRepository = (source: PaletteSource, deps: LocalPaletteDeps): PaletteRepository =>
    source === 'api' ? createHttpPaletteRepository() : createLocalPaletteRepository(deps);
