import type { DesignSystemVersionDto } from '../api/types';

/** Выбор контекста, который плагин запоминает для пользователя. */
export interface SavedContext {
    projectId?: string;
    designSystemId?: string;
    tenantId?: string;
}

/** Вариант, который выбирается без пользователя: запомненный, если он ещё доступен, или единственный. */
export const automaticChoice = <T extends { id: string }>(items: T[], savedId?: string): T | null =>
    items.find((item) => item.id === savedId) ?? (items.length === 1 ? items[0] : null);

/** Опубликованные версии от новой к старой. */
export const publishedVersions = (versions: DesignSystemVersionDto[]) =>
    versions.filter((version) => version.publishedAt).sort((a, b) => b.sequenceNumber - a.sequenceNumber);

/** Версия по умолчанию: последняя опубликованная, без опубликованных — черновик (`null`). */
export const defaultVersionId = (versions: DesignSystemVersionDto[]) => publishedVersions(versions)[0]?.id ?? null;

export const parseSavedContext = (raw: string | null): SavedContext => {
    try {
        return raw ? (JSON.parse(raw) as SavedContext) : {};
    } catch {
        return {};
    }
};
