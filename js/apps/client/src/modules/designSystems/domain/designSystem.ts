import type { ThemePreview } from '../../themes/domain/theme';

export interface DesignSystem {
    id: string;
    projectId: string | null;
    isTechnical?: boolean;
    name: string;
    description?: string | null;
    tenantCount: number;
    themePreviews: Array<{ tenantId: string; name: string; preview: ThemePreview }>;
    draftId?: string | null;
    draftRevision?: number | null;
}

/** Определение токена в файле темы: у цвета и градиента имя начинается с режима `light.`/`dark.`. */
export interface ThemeFileToken {
    type: string;
    name: string;
    displayName?: string | null;
    description?: string | null;
    enabled?: boolean;
}

/** Файл темы в формате импорта и экспорта: `meta` и значения `variations[тип][платформа][имя]`. */
export interface ThemeFile {
    meta: { name: string; version?: string | null; tokens: ThemeFileToken[] };
    variations: Record<string, Record<string, Record<string, unknown>>>;
}

export interface ImportedDesignSystem {
    designSystemId: string;
    tenantId: string;
    /** Токены файла, которых нет в наборе новой дизайн-системы: их значения не записаны. */
    skippedTokens: string[];
}

export interface DesignSystemTokenDefinition {
    id: string;
    name: string;
    type: string;
}

export const formatThemeCount = (count: number) => {
    const lastTwo = count % 100;
    const last = count % 10;
    const noun =
        last === 1 && lastTwo !== 11
            ? 'тема'
            : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
              ? 'темы'
              : 'тем';
    return `${count} ${noun}`;
};
