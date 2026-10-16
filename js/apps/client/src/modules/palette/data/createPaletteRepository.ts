import type { PaletteRepository } from '../application/paletteRepository';
import { createHttpPaletteRepository } from './httpPaletteRepository';
import { createLocalPaletteRepository, type LocalPaletteDeps } from './localPaletteRepository';

export type PaletteSource = 'api' | 'local';

/** Источник палитры из `VITE_PALETTE_SOURCE`: по умолчанию `api` (`ds-service`), `local` — палитра в браузере. */
export const paletteSourceFromEnv = (value: string | undefined = import.meta.env.VITE_PALETTE_SOURCE): PaletteSource =>
    value === 'local' ? 'local' : 'api';

export const createPaletteRepository = (source: PaletteSource, deps: LocalPaletteDeps): PaletteRepository =>
    source === 'api' ? createHttpPaletteRepository() : createLocalPaletteRepository(deps);
