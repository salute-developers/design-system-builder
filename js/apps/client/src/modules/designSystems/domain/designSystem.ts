import type { ThemePreview } from '../../themes/domain/theme';

export interface DesignSystem {
    id: string;
    projectId: string | null;
    isTechnical?: boolean;
    name: string;
    description?: string | null;
    tenantCount: number;
    themePreviews: Array<{ tenantId: string; name: string; preview: ThemePreview }>;
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
