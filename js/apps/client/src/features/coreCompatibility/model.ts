import type { CoreIssue } from '../../api/coreCompatibilityRepository';
import type { PropertySource } from '../../pages/components/features/ComponentInspector/inspectorModel';
import { toComponentRoute } from '../../composePreview';

export const coreIssueMessages: Record<string, string> = {
    CORE_COMPONENT_REMOVED: 'Компонент отсутствует в выбранной библиотеке',
    CORE_SELECTION_REQUIRED: 'Для платформы не выбрана версия библиотеки',
    CORE_PROPERTY_REMOVED: 'Свойство отсутствует в выбранной версии библиотеки.',
    CORE_STATE_REMOVED: 'Сохранённое состояние недоступно',
    CORE_VALUE_TYPE_CONFLICT: 'Сохранённое значение не подходит типу свойства',
    CORE_PLATFORM_PARAM_REMOVED: 'Платформенный параметр недоступен',
    CORE_PROPERTY_DEPRECATED: 'Свойство устарело',
    CORE_TOKEN_UNAVAILABLE: 'Токен отсутствует или отключён',
    CORE_COMPONENT_REFERENCE_UNAVAILABLE: 'Вложенное оформление недоступно',
    CORE_COMPONENT_TARGET_CONFLICT: 'Свойство не допускает выбранный вложенный компонент',
};
export const issueScope = (issue: CoreIssue) =>
    [
        issue.location.appearanceName ?? 'default',
        issue.location.styleLabels.join(' + ') || 'База',
        issue.location.states.join(' + ') || 'Без состояния',
    ].join(' · ');
export const issueValue = (issue: CoreIssue) => {
    const v = issue.storedValue;
    return v?.tokenId
        ? `${v.tokenName ?? v.tokenId} (токен)`
        : v?.targetAppearanceId
          ? `${v.targetAppearanceId} · ${v.targetStyleIds.join(', ')}`
          : (v?.literal ?? 'Не задано');
};
export const sameStyles = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id) => b.includes(id));
export const issueMatchesSource = (issue: CoreIssue, source: PropertySource) =>
    sameStyles(
        issue.location.styleIds,
        source.kind === 'invariant' ? [] : source.kind === 'style' ? [source.styleID] : source.styleIDs,
    );
export const issueNodeId = (issue: CoreIssue) => `core-assignment-${encodeURIComponent(issue.issueId)}`;
/** Ссылка не зависит от состояния React: оформление и issueId восстанавливаются после обновления страницы. */
export const issueEditorHref = (issue: CoreIssue, base: string, search: string) => {
    const q = new URLSearchParams(search);
    q.delete('diagnosticComponentId');
    q.delete('diagnosticPlatform');
    q.set('issueId', issue.issueId);
    q.set('section', 'style');
    if (issue.location.appearanceId) q.set('configuration', issue.location.appearanceId);
    else q.delete('configuration');
    if (issue.code === 'CORE_SELECTION_REQUIRED') {
        q.set('section', 'core');
        return `${base.replace(/\/themes\/[^/]+$/, '')}/settings?${q}`;
    }
    if (!['web', 'compose'].includes(issue.location.platform)) return `${base}/validation?${q}`;
    return `${base}/components/${toComponentRoute(issue.location.platform as 'web' | 'compose', issue.location.componentName)}?${q}`;
};

export const formatProblemCount = (count: number) => {
    const form = new Intl.PluralRules('ru').select(count);
    const forms: Record<string, string> = { one: 'проблема', few: 'проблемы' };
    return `${count} ${forms[form] ?? 'проблем'}`;
};
export const validationLabel = (count: number) => `Валидация (${formatProblemCount(count)})`;

const compatibilityStates = {
    unavailable: {
        label: 'Недоступна',
        message: 'Не удалось проверить совместимость с выбранными версиями библиотек.',
    },
    loading: { label: 'Проверяем…', message: 'Проверяем совместимость с выбранными версиями библиотек.' },
    blocked: { label: 'Есть проблемы', message: 'Публикация недоступна до исправления проблем совместимости.' },
    compatible: { label: 'Совместимо', message: 'Блокирующих проблем совместимости нет.' },
};

export const compatibilityStatus = (report?: { blockingCount: number }, error?: string) => {
    if (error) return compatibilityStates.unavailable;
    if (!report) return compatibilityStates.loading;
    return report.blockingCount > 0 ? compatibilityStates.blocked : compatibilityStates.compatible;
};
