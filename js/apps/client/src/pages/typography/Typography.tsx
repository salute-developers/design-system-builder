import { useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import '../../styles/typography.css';

import { WorkspaceLoadError } from '../../components/tokenWorkspace';
import type { DesignSystem, Theme } from '../../controllers';
import { TypographyScreen } from './TypographyScreen';
import { TypographyBoardSkeleton } from './ui/TypographyBoard';

interface TypographyOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    rerender: () => void;
    reload: () => void;
    changedTokenNames?: Set<string>;
    sectionError?: unknown;
    sectionPending?: boolean;
}

/** Раздел «Типографика» темы: экран стилей по Figma с автосохранением правок. */
export const Typography = () => {
    const outlet = useOutletContext<TypographyOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const [searchParams] = useSearchParams();
    const versionId = searchParams.get('versionId') ?? undefined;
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId, versionId } : null),
        [projectId, designSystemId, tenantId, versionId],
    );

    if (outlet.sectionError) {
        return (
            <div className="typography-screen" data-testid="typography-error">
                <WorkspaceLoadError title="Не удалось загрузить типографику" onRetry={outlet.reload} />
            </div>
        );
    }
    if (!context || !outlet.designSystem || !outlet.theme || outlet.sectionPending) {
        return (
            <div className="typography-screen" data-testid="typography-loading">
                <div className="typography-pending" role="status" aria-label="Загружаем стили типографии">
                    <TypographyBoardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <TypographyScreen
            key={`${context.projectId}:${context.designSystemId}:${context.tenantId}:${context.versionId ?? ''}`}
            context={context}
            designSystem={outlet.designSystem}
            theme={outlet.theme}
            rerender={outlet.rerender}
            reload={outlet.reload}
            changedTokenNames={outlet.changedTokenNames}
        />
    );
};
