import { useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';

import type { DesignSystem, Theme } from '../../controllers';
import { TypographyScreen } from './TypographyScreen';

interface TypographyOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    rerender: () => void;
}

/** Раздел «Типографика» темы: экран Typography по прототипу SDDS Portal с автосохранением правок. */
export const Typography = () => {
    const outlet = useOutletContext<TypographyOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId } : null),
        [projectId, designSystemId, tenantId],
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
            key={`${context.projectId}:${context.designSystemId}:${context.tenantId}`}
            context={context}
            designSystem={outlet.designSystem}
            theme={outlet.theme}
            rerender={outlet.rerender}
        />
    );
};
