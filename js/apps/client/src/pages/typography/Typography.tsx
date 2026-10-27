import { useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import type { DesignSystem, Theme } from '../../controllers';
import { TypographyScreen } from './TypographyScreen';

interface TypographyOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    rerender: () => void;
    changedTokenNames?: Set<string>;
}

/** Раздел «Типографика» темы: экран Typography по прототипу SDDS Portal с автосохранением правок. */
export const Typography = () => {
    const outlet = useOutletContext<TypographyOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const [searchParams] = useSearchParams();
    const versionId = searchParams.get('versionId') ?? undefined;
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId, versionId } : null),
        [projectId, designSystemId, tenantId, versionId],
    );

    if (!context || !outlet.designSystem || !outlet.theme) {
        return (
            <div className="typography-screen" data-testid="typography-loading">
                <div className="ty-loading" role="status">
                    Загружаем стили типографии…
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
            changedTokenNames={outlet.changedTokenNames}
        />
    );
};
