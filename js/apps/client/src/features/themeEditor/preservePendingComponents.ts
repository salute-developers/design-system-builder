import type { Config } from '../../controllers/componentBuilder/config';
import type { EditorContextKey } from '../../api/editorContracts';
import { getDraftAutosaveSourceStatus } from '../../api/draftAutosaveActivity';

/** Снимок соседнего компонента не должен заменять изменённые экземпляры скрытого компонента. */
export function preservePendingComponents(context: EditorContextKey, current: Config[] | null, next: Config[]) {
    const pending = (current ?? []).filter((local) => {
        const route = `${local.getPlatform() === 'compose' ? 'compose-' : ''}${local.getName()}`;
        const server = next.find(
            (item) => item.getName() === local.getName() && item.getPlatform() === local.getPlatform(),
        );
        const sameCore = !server || server.getCoreSelectionRevision() === local.getCoreSelectionRevision();
        return sameCore && getDraftAutosaveSourceStatus(context, `component:${route}`) !== 'saved';
    });
    const retained = next.filter(
        (item) =>
            !pending.some((local) => local.getName() === item.getName() && local.getPlatform() === item.getPlatform()),
    );
    return [...retained, ...pending];
}
