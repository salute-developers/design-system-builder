import { http } from './http';
import { invalidateEditorReads, invalidateEditorResources, readEditor } from './editorReads';
import { apiRoot, tokenDefinitionsUrl } from './editorHttp';
import type { AppearanceDto, AppearanceEditorModelDto, EditorContextKey, TokenDefinitionDto } from './editorContracts';

/**
 * Структура компонента: конфигурации, их вариации (оси) и значения — через редакторский API `ds-service`.
 * Операции выполняются сразу, без очереди автосохранения; после них редактор перечитывает компонент.
 */
// Конфигурации, их вариации и значения свойств — ресурсы дизайн-системы контекста.
const root = (context: EditorContextKey) => apiRoot(context.projectId, context.designSystemId);
const create = { headers: () => ({ 'Idempotency-Key': crypto.randomUUID() }) };

/** Ссылка на токен — имя через точки (`text.default.primary`); число, `#RRGGBB` и прочие литералы — нет. */
const TOKEN_REFERENCE = /^[a-z][\w-]*(\.[\w-]+)+$/i;

/**
 * ID токена по имени. Справочник переиспользуется между правками, как другие списочные чтения редактора; запись
 * определения токена сбрасывает его адресно. Если имени в справочнике нет, справочник мог устареть (токен создан или
 * переименован в другом месте) — он перечитывается один раз.
 */
const tokenIdOf = async (context: EditorContextKey, name: string) => {
    const url = tokenDefinitionsUrl(context);
    const find = async () =>
        (await readEditor<TokenDefinitionDto[]>(url, {}, undefined, 300_000)).data.find((token) => token.name === name)
            ?.id;
    const cached = await find();
    if (cached) return cached;
    invalidateEditorResources([url]);
    return (await find()) ?? null;
};

const done = <T>(context: EditorContextKey, value: T) => {
    invalidateEditorReads(context);
    return value;
};

export const componentStructureRepository = {
    /** Модель конфигурации: оси с ID вариаций, стилей, отображаемыми именами и стилем по умолчанию. */
    async loadModel(context: EditorContextKey, appearanceId: string, signal?: AbortSignal) {
        const { data } = await http.get<AppearanceEditorModelDto>(
            `${root(context)}/appearances/${appearanceId}/editor-model`,
            { signal },
        );
        return data;
    },

    async createConfiguration(context: EditorContextKey, componentId: string) {
        const { data } = await http.post<AppearanceDto>(
            `${root(context)}/appearances/new`,
            { componentId },
            { headers: create.headers() },
        );
        return done(context, data);
    },

    async duplicateConfiguration(context: EditorContextKey, appearanceId: string) {
        const { data } = await http.post<AppearanceDto>(
            `${root(context)}/appearances/${appearanceId}/duplicate`,
            {},
            { headers: create.headers() },
        );
        return done(context, data);
    },

    async renameConfiguration(context: EditorContextKey, appearanceId: string, name: string) {
        await http.patch(`${root(context)}/appearances/${appearanceId}`, { name });
        return done(context, undefined);
    },

    async deleteConfiguration(context: EditorContextKey, appearanceId: string) {
        await http.delete(`${root(context)}/appearances/${appearanceId}`);
        return done(context, undefined);
    },

    /** Новая вариация конфигурации со значением `default`, которое становится стилем по умолчанию. */
    async addAxis(context: EditorContextKey, appearanceId: string, name: string) {
        await http.post(
            `${root(context)}/appearances/${appearanceId}/axes`,
            { name, values: ['default'], defaultValue: 'default' },
            { headers: create.headers() },
        );
        return done(context, undefined);
    },

    /** Удаляет вариацию из конфигурации вместе со значениями свойств её стилей. */
    async deleteAxis(context: EditorContextKey, appearanceId: string, axisId: string) {
        await http.delete(`${root(context)}/appearances/${appearanceId}/axes/${axisId}`, {
            params: { confirmCascade: true },
        });
        return done(context, undefined);
    },

    /** Порядок вариаций конфигурации: список должен содержать каждую ось ровно один раз. */
    async reorderAxes(context: EditorContextKey, appearanceId: string, axisIds: string[]) {
        await http.post(`${root(context)}/appearances/${appearanceId}/axis-order`, { axisIds });
        return done(context, undefined);
    },

    /** Переименование вариации только в этой конфигурации (отображаемое имя оси). */
    async renameAxis(context: EditorContextKey, axisId: string, name: string) {
        await http.patch(`${root(context)}/appearance-variations/${axisId}`, { displayName: name });
        return done(context, undefined);
    },

    async setDefaultValue(context: EditorContextKey, axisId: string, styleId: string) {
        await http.patch(`${root(context)}/appearance-variations/${axisId}`, { defaultStyleId: styleId });
        return done(context, undefined);
    },

    async addValue(context: EditorContextKey, appearanceId: string, axisId: string, name: string) {
        await http.post(
            `${root(context)}/appearances/${appearanceId}/axes/${axisId}/values`,
            { name },
            { headers: create.headers() },
        );
        return done(context, undefined);
    },

    /** Переименование значения только в этой конфигурации (отображаемое имя значения). */
    async renameValue(context: EditorContextKey, valueId: string, name: string) {
        await http.patch(`${root(context)}/appearance-variation-values/${valueId}`, { displayName: name });
        return done(context, undefined);
    },

    /** Удаляет значение из вариации конфигурации вместе со значениями свойств его стиля. */
    async deleteValue(context: EditorContextKey, appearanceId: string, valueId: string) {
        await http.delete(`${root(context)}/appearances/${appearanceId}/axis-values/${valueId}`, {
            params: { confirmCascade: true },
        });
        return done(context, undefined);
    },

    /** Привязывает свойство к вариации: без привязки свойство не считается меняющимся по этой вариации. */
    async linkProperty(context: EditorContextKey, propertyId: string, variationId: string) {
        await http.post(
            `${root(context)}/property-variations`,
            { propertyId, variationId },
            { headers: create.headers() },
        );
        return done(context, undefined);
    },

    /**
     * Значение свойства пересечения стилей `styleIds`: первое значение создаёт пересечение. Ссылка на токен
     * (`[light.text.default.primary]`) пишется ID токена, остальное — литералом, как в автосохранении.
     */
    async setCombinationValue(
        context: EditorContextKey,
        appearanceId: string,
        styleIds: string[],
        propertyId: string,
        value: string,
        adjustment?: string,
    ) {
        const raw = value.replace(/^\[|\]$/g, '');
        const tokenId = TOKEN_REFERENCE.test(raw) ? await tokenIdOf(context, raw.replace(/^(light|dark)\./, '')) : null;
        await http.put(
            `${root(context)}/appearances/${appearanceId}/property-values`,
            { propertyId, styleIds, tokenId, value: tokenId ? null : raw, adjustment: adjustment ?? null },
            { headers: create.headers() },
        );
        return done(context, undefined);
    },

    /** Сбрасывает значение свойства пересечения: снова действует значение обычного стиля. */
    async removeCombinationValue(
        context: EditorContextKey,
        appearanceId: string,
        styleIds: string[],
        propertyId: string,
    ) {
        await http.delete(`${root(context)}/appearances/${appearanceId}/property-values`, {
            params: { propertyId, styleIds: styleIds.join(',') },
        });
        return done(context, undefined);
    },

    /** Удаляет пересечение: все значения свойств сочетания `styleIds`, по одному запросу на свойство. */
    async removeCombination(context: EditorContextKey, appearanceId: string, styleIds: string[]) {
        const wanted = [...styleIds].sort().join(',');
        const { propertyValues } = await componentStructureRepository.loadModel(context, appearanceId);
        const own = propertyValues.filter(
            (item) => item.kind === 'combination' && [...item.styleIds].sort().join(',') === wanted,
        );
        for (const item of own) {
            await http.delete(`${root(context)}/appearances/${appearanceId}/property-values`, {
                params: {
                    propertyId: item.propertyId,
                    styleIds: item.styleIds.join(','),
                    states: item.states.join(','),
                },
            });
        }
        return done(context, undefined);
    },
};
