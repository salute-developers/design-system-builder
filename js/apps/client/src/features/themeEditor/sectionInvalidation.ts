import type { DraftRefreshChange } from '../../api/editorContracts';
import type { DraftInvalidationScope } from '../../api/draftInvalidationStream';
import type { EditorSection } from './editorSections';

interface InvalidationRule {
    sections: readonly EditorSection[];
    shell?: boolean;
    colorGroups?: boolean;
}

const tokenSections: readonly EditorSection[] = ['colors', 'palette', 'typography', 'shapes', 'components'];
const metadata: InvalidationRule = {
    sections: ['settings', ...tokenSections], shell: true, colorGroups: true,
};
const all: InvalidationRule = {
    sections: [...tokenSections, 'settings', 'changes', 'versions'], shell: true, colorGroups: true,
};
const rules: Record<DraftInvalidationScope, InvalidationRule> = {
    all,
    'design-system': all,
    'theme-metadata': metadata,
    'theme-tokens': { sections: tokenSections },
    'component-configurations': { sections: ['components'], shell: true },
};

/** Объединяет области обновления; адресный откат значений сохраняет уже загруженные группы. */
export const sectionInvalidation = (scopes: Set<DraftInvalidationScope>, changes?: DraftRefreshChange[]) => {
    const selected = [...scopes].map((scope) => rules[scope]);
    const onlyTokenChanges = changes?.every((change) => ['token', 'token-value'].includes(change.entityType));
    return {
        sections: new Set(selected.flatMap((rule) => rule.sections)),
        shell: selected.some((rule) => rule.shell),
        colorGroups: selected.some((rule) => rule.colorGroups) || (scopes.has('theme-tokens') && !onlyTokenChanges),
    };
};
