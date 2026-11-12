import type { DraftTokenTarget, DraftTokenTargetsPage } from './editorContracts';

type LoadPage = (cursor: string | null) => Promise<DraftTokenTargetsPage>;

/** Читает один согласованный снимок области. Ошибка не возвращает частично собранные цели. */
export const readTokenTargetPages = async (draftId: string, load: LoadPage): Promise<DraftTokenTarget[]> => {
    const targets: DraftTokenTarget[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    let scopeRevision: string | undefined;
    do {
        const page = await load(cursor);
        if (page.draftId !== draftId) throw new Error('Изменился черновик');
        if (scopeRevision !== undefined && scopeRevision !== page.scopeRevision)
            throw new Error('Изменилась область целей');
        scopeRevision = page.scopeRevision;
        targets.push(...page.targets);
        cursor = page.nextCursor;
        if (cursor) {
            if (seen.has(cursor) || seen.size >= 64) throw new Error('Некорректные страницы целей');
            seen.add(cursor);
        }
    } while (cursor);
    return targets;
};
