import { useRef } from 'react';

import { hexToHsva, hsvaToHex, type Hsva } from './colorMath';

/**
 * Положение ползунков для цвета [hex]. HEX белого, чёрного и почти серых цветов не хранит тон точно, поэтому, пока
 * цвет совпадает с последним записанным, ползунки остаются там, где их оставили, а не восстанавливаются из HEX.
 */
export const useWrittenHsva = (hex: string) => {
    const written = useRef<Hsva | null>(null);
    const parsed = hexToHsva(hex);
    const hsva = written.current && hsvaToHex(written.current) === hsvaToHex(parsed) ? written.current : parsed;
    const remember = (next: Hsva) => {
        written.current = next;
    };
    return [hsva, remember] as const;
};
