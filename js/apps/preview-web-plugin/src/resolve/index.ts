import { toCoreCssVariables } from '../cssVariables';
import type { PreviewPayload, PreviewPropertyValue, ResolvedPreview } from '../protocol';
import { apiMeta, indexMeta, type ApiMeta, type MetaIndex } from './meta';
import { resolveComponentParams, type ResolveContext } from './properties';
import { groupRelatedStyles, resolveComposeVariables, resolveRelatedComponents } from './related';
import { indexTemplates, webAdapter, type WebAdapter } from './templates';
import { bodyFontFamily, fontFaces, surfaceBackground, themeVariables } from './theme';
import { pathKey, WarningSink } from './warnings';

export type { ApiMeta, ApiMetaComponent, ApiMetaParam } from './meta';
export type { WebAdapter, WebAdapterEntry } from './templates';
export { apiMeta, indexMeta } from './meta';
export { webAdapter } from './templates';

/**
 * Перевод payload общего формата в стили web-библиотеки — чистая функция без DOM и React:
 * - свойства компонента по мете (`meta.ts`) → ключи ядра, значения — из литералов и токенов `theme`
 *   (`tokens.ts`, `typography.ts`) с шаблонами `web-adapter.json` (`templates.ts`), ключи → CSS-переменные ядра
 *   по объектам токенов (`cssVariables.ts`);
 * - окружение story: переменные цветов темы, фон, шрифт тела, `@font-face` (`theme.ts`);
 * - связанные компоненты из `styles` и общие переменные зависимостей `compose` (`related.ts`).
 * Порядок перекрытия `variables` — как у прежнего React-превью клиента: `compose`-зависимости, компонент, тема.
 */
export const resolvePayload = (
    payload: PreviewPayload,
    meta: ApiMeta = apiMeta,
    adapter: WebAdapter = webAdapter,
): ResolvedPreview => {
    const warnings = new WarningSink();
    const ctx: ResolveContext = {
        meta: indexMeta(meta),
        templates: indexTemplates(adapter),
        theme: payload.theme,
        warnings,
    };
    const component = payload.component.id;

    const componentVariables = toCoreCssVariables(
        component,
        resolveComponentParams(component, payload.component.properties, ctx, '$.component.properties'),
    );
    const groups = groupRelatedStyles(payload.styles);
    const relatedVariables = resolveComposeVariables(component, payload.component.variations, groups, payload.styles, ctx);
    const relatedComponents = resolveRelatedComponents(component, groups, payload.styles, ctx);
    const themeVars = themeVariables(payload.theme);
    const fontFamily = bodyFontFamily(payload);
    const background = surfaceBackground(payload);

    return {
        variables: { ...relatedVariables, ...componentVariables, ...themeVars },
        componentVariables,
        relatedVariables,
        themeVariables: themeVars,
        relatedComponents,
        fontFaces: fontFaces(payload, warnings),
        ...(fontFamily ? { fontFamily } : {}),
        ...(background ? { background } : {}),
        warnings: warnings.list,
    };
};

/** CSS-значение в строке: единицы (`3rem`, `12px`) или функции CSS (`var(…)`, `calc(…)`, `rgba(…)`, градиенты). */
const CSS_STRING = /(^|[\s(,])-?\d*\.?\d+(rem|px|em|vh|vw)\b|\b(var|calc|rgba?|hsla?|linear-gradient|radial-gradient)\(/i;

/**
 * Значение свойства, заранее переведённое в CSS (старый формат `WEB`): строковый литерал с единицами или функциями
 * CSS у свойства, параметр которого в мете не `value`, или у свойства, названного ключом ядра компонента
 * (`buttonBackgroundColorHover`). У параметров типа `value` CSS-строка — нормальное значение (`0 0.5rem`, `auto`).
 * Возвращает путь первого такого значения.
 */
export const findPreconvertedCss = (payload: PreviewPayload, meta: ApiMeta = apiMeta): string | undefined => {
    const index: MetaIndex = indexMeta(meta);
    const check = (component: string, properties: Record<string, PreviewPropertyValue>, path: string) => {
        const componentMeta = index.get(component);
        for (const [name, value] of Object.entries(properties)) {
            const propertyMeta = componentMeta?.properties.get(name);
            const expectsCss = propertyMeta
                ? [...propertyMeta.base, ...[...propertyMeta.states.values()].flat()].some((param) => param.type === 'value')
                : !componentMeta?.paramNames.has(name);
            if (expectsCss) continue;
            const sources = [
                ['base', value.base] as const,
                ...(value.states ?? []).map((entry, i) => [`states[${i}].source`, entry.source] as const),
            ];
            for (const [suffix, source] of sources) {
                if (source.type === 'literal' && typeof source.value === 'string' && CSS_STRING.test(source.value)) {
                    return `${path}${pathKey(name)}.${suffix}.value`;
                }
            }
        }
        return undefined;
    };

    return (
        check(payload.component.id, payload.component.properties, '$.component.properties') ??
        Object.entries(payload.styles)
            .map(([styleId, style]) => check(style.component, style.properties, `$.styles${pathKey(styleId)}.properties`))
            .find(Boolean)
    );
};
