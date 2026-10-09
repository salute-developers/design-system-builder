import { additional, general } from '@salutejs/plasma-colors';

import type { PaletteTemplate } from '../domain';

export type TemplateColorSource = (type: string, shade: string, step: string) => string | undefined;

/**
 * Шаблон режима `local`. Состав растяжек и ступеней берётся из `@salutejs/plasma-colors`, а значения —
 * тем же резолвером, что строит превью (`restore`): превью тем без правок палитры остаются прежними.
 */
export const buildLocalTemplate = (restore: TemplateColorSource): PaletteTemplate => {
    const template: PaletteTemplate = {};
    const sources = { general, additional } as Record<string, Record<string, Record<string, string>>>;
    for (const [type, ramps] of Object.entries(sources)) {
        for (const [shade, steps] of Object.entries(ramps)) {
            const values: Record<string, string> = {};
            for (const step of Object.keys(steps)) {
                const value = restore(type, shade, step);
                if (typeof value === 'string' && value.startsWith('#')) values[step] = value.toUpperCase();
            }
            if (Object.keys(values).length) template[`${type}.${shade}`] = values;
        }
    }
    return template;
};
