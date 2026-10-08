import {
    collectLinks,
    defaultGroupForToken,
    isDraftTokenId,
    PaletteOperationError,
    rampKey,
    sameRamp,
    type LocalThemeInput,
    type PaletteContext,
    type PaletteLink,
    type PaletteLinksQuery,
    type PaletteRampRef,
    type PaletteRepository,
    type PaletteState,
    type PaletteTokenAssignment,
    type ThemePalette,
    type TokenReferenceRewrite,
} from '../modules/palette';

export interface DraftAwareDeps {
    /** Токены и значения открытой темы с черновиком или `null`, если тема не открыта. */
    theme: (context: PaletteContext) => LocalThemeInput | null;
    /** Сохранённые на сервере токены, у которых есть запись черновика: их значения в редакторе не серверные. */
    drafted: (context: PaletteContext) => ReadonlySet<string>;
    /**
     * Переписывает ссылки в черновике: токенов только из черновика — всегда, сохранённых на сервере — если у них
     * есть запись черновика (иначе их значения уже переписал сервер).
     */
    applyRewrite: (
        context: PaletteContext,
        rewrite: TokenReferenceRewrite,
        resolveHex: (step: number) => string | undefined,
    ) => void;
}

const sameContext = (a: PaletteContext, b: PaletteContext) =>
    a.projectId === b.projectId && a.designSystemId === b.designSystemId && a.tenantId === b.tenantId;

const pairs = (links: PaletteLink[]) => new Set(links.map((link) => `${link.tokenId}|${link.mode ?? ''}`)).size;

const templateOf = (palette: ThemePalette): PaletteState['template'] =>
    Object.fromEntries(
        palette.template.map((ramp) => [
            rampKey(ramp),
            Object.fromEntries(ramp.steps.map((item) => [String(item.step), item.value])),
        ]),
    );

/**
 * Адаптер `api` с учётом черновика клиента. Сервер знает только сохранённые значения токенов, а в редакторе действуют
 * значения черновика: у новых токенов (`draft:`) и у сохранённых с записью черновика. Связи таких токенов считаются по
 * черновику, удаление растяжки без стратегии при них отклоняется, а после удаления ссылки переписываются и в черновике.
 */
export const withDraftTokens = (base: PaletteRepository, deps: DraftAwareDeps) => {
    let loaded: { context: PaletteContext; palette: ThemePalette } | null = null;

    const palette = (context: PaletteContext) =>
        loaded && sameContext(loaded.context, context) ? loaded.palette : null;

    /** Связи токенов, значения которых в редакторе берутся из черновика. */
    const draftLinks = (context: PaletteContext, { slot, groupId, step }: PaletteLinksQuery): PaletteLink[] => {
        const current = palette(context);
        const input = deps.theme(context);
        if (!current || !input) return [];
        const drafted = deps.drafted(context);
        const tokens = input.tokens.filter((token) => isDraftTokenId(token.id) || drafted.has(token.id));
        if (!tokens.length) return [];
        const groupBySystemKey = new Map(current.groups.map((group) => [group.systemKey, group.id]));
        const serverGroup = new Map(current.tokens.map((token) => [token.tokenId, token.groupId]));
        const assignments: PaletteTokenAssignment[] = tokens.map((token) => ({
            tokenId: token.id,
            tokenName: token.name,
            // Сохранённый токен — в своей группе (в том числе явной); токен черновика — по правилу имени.
            groupId: serverGroup.get(token.id) ?? groupBySystemKey.get(defaultGroupForToken(token.name)) ?? '',
            assignment: 'default',
        }));
        const state: PaletteState = {
            version: 1,
            editRevision: current.editRevision,
            template: templateOf(current),
            groups: [],
            ramps: [],
            tokenGroups: {},
        };
        const ids = new Set(tokens.map((token) => token.id));
        return collectLinks(
            state,
            tokens,
            input.values.filter((value) => ids.has(value.tokenId)),
            assignments,
        )
            .filter(
                (link) =>
                    sameRamp(link.slot, slot) &&
                    (groupId === undefined || link.groupId === groupId) &&
                    (step === undefined || link.step === step),
            )
            .map(({ tokenId, tokenName, displayName, groupId: linkGroup, mode, step: linkStep, opacity, platforms }) => ({
                tokenId,
                tokenName,
                displayName,
                groupId: linkGroup,
                mode,
                step: linkStep,
                opacity,
                platforms,
            }));
    };

    const missingSteps = (context: PaletteContext, replacement: PaletteRampRef, links: PaletteLink[]) => {
        const steps = palette(context)?.template.find((ramp) => sameRamp(ramp, replacement))?.steps ?? [];
        const available = new Set(steps.map((item) => item.step));
        return [...new Set(links.map((link) => link.step))]
            .filter((value) => !available.has(value))
            .sort((a, b) => a - b);
    };

    /** Цвет ступени слота в группе, как его вычисляет сервер: растяжка группы, иначе копия шаблона слота. */
    const stepHex = (context: PaletteContext, groupId: string, slot: PaletteRampRef) => {
        const current = palette(context);
        const ramp = current?.groups.find((group) => group.id === groupId)?.ramps.find((item) => sameRamp(item.slot, slot));
        const template = current?.template.find((item) => sameRamp(item, slot));
        return (step: number) =>
            ramp?.steps.find((item) => item.step === step)?.value ??
            template?.steps.find((item) => item.step === step)?.value;
    };

    const repository: PaletteRepository = {
        ...base,
        load: async (context, signal) => {
            const value = await base.load(context, signal);
            loaded = { context, palette: value };
            return value;
        },
        links: async (context, query) => {
            // Связи токенов с записью черновика считаются по черновику, а не по сохранённым значениям.
            const drafted = deps.drafted(context);
            const server = (await base.links(context, query)).filter((link) => !drafted.has(link.tokenId));
            return [...server, ...draftLinks(context, query)];
        },
        removeRamp: async (context, groupId, slot, input) => {
            const linked = draftLinks(context, { slot, groupId });
            if (linked.length && !input.strategy)
                throw new PaletteOperationError(409, 'PALETTE_RAMP_LINKED', 'У растяжки есть связанные токены черновика');
            if (linked.length && input.strategy === 'replace' && input.replacement) {
                const steps = missingSteps(context, input.replacement, linked);
                if (steps.length)
                    throw new PaletteOperationError(409, 'PALETTE_STEP_MISSING', 'В новой растяжке нет используемых ступеней', {
                        steps,
                    });
            }
            const resolveHex = stepHex(context, groupId, slot);
            const groupTokens = palette(context)
                ?.tokens.filter((token) => token.groupId === groupId)
                .map((token) => token.tokenId);
            const result = await base.removeRamp(context, groupId, slot, input);
            if (input.strategy) {
                // Токены группы: сохранённые на сервере и из черновика; переписываются только ссылки на убранный слот.
                // Сервер уже применил операцию, поэтому ошибка записи черновика не отменяет её: тема перезагрузится,
                // а запись черновика останется прежней.
                try {
                    deps.applyRewrite(
                        context,
                        {
                            tokenIds: [...new Set([...(groupTokens ?? []), ...linked.map((link) => link.tokenId)])],
                            from: slot,
                            to: input.strategy === 'replace' && input.replacement ? input.replacement : 'detach',
                        },
                        resolveHex,
                    );
                } catch (error) {
                    console.error('Не удалось переписать ссылки в черновике после удаления растяжки', error);
                }
            }
            // Связи сохранённых токенов сервер уже посчитал; добавляются только связи новых токенов черновика.
            const draftOnly = linked.filter((link) => isDraftTokenId(link.tokenId)).length;
            return { ...result, value: { reassigned: result.value.reassigned + draftOnly } };
        },
    };

    return {
        repository,
        /**
         * Черновые связи растяжки группы: `added` — пары «токен, режим» новых токенов (их нет в `linkedCount` сервера),
         * `any` — есть ли черновые связи, включая сохранённые токены с записью черновика.
         */
        draftLinks: (context: PaletteContext, groupId: string, slot: PaletteRampRef) => {
            const links = draftLinks(context, { slot, groupId });
            return { added: pairs(links.filter((link) => isDraftTokenId(link.tokenId))), any: links.length > 0 };
        },
    };
};
