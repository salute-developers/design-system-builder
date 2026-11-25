/** База `rem`: размеры конфигурации и темы в px делятся на неё. */
export const REM_BASE = 16;

/** px → `rem`: `48` → `3rem`. */
export const pxToRem = (px: number): string => `${px / REM_BASE}rem`;

/** Радиус формы с поправкой в px: `calc(<радиус> + <поправка>rem)`. */
export const adjustedRadius = (radius: string, adjustmentPx: number): string => `calc(${radius} + ${pxToRem(adjustmentPx)})`;
