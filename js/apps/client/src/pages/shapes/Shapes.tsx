import { useMemo } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import '../../styles/size-tokens.css';

import type { DesignSystem, Theme } from '../../controllers';
import type { ThemePalette } from '../../modules/palette';
import { SizeTokensScreen } from './SizeTokensScreen';
import { SizeTokensPlaceholder } from './ui/SizeTokensPlaceholder';

interface ShapesOutletContextProps {
    designSystem?: DesignSystem | null;
    theme?: Theme | null;
    palette?: ThemePalette | null;
    rerender: () => void;
    /** Токены с неопубликованными изменениями: отметка в дереве, как у «Типографики». */
    changedTokenNames?: Set<string>;
    reload: () => void;
    /** Ошибка и загрузка раздела: экран показывает свои заглушки вместо общих у `Main`. */
    sectionError?: unknown;
    sectionPending?: boolean;
}

/** Раздел «Отступы, радиусы и тени» темы по Figma с автосохранением правок. */
export const Shapes = () => {
    const outlet = useOutletContext<ShapesOutletContextProps>();
    const { projectId, designSystemId, tenantId } = useParams();
    const [searchParams] = useSearchParams();
    // Опубликованная версия из адреса: раздел читает её значения и доступен только для чтения.
    const versionId = searchParams.get('versionId') ?? undefined;
    const context = useMemo(
        () => (projectId && designSystemId && tenantId ? { projectId, designSystemId, tenantId, versionId } : null),
        [projectId, designSystemId, tenantId, versionId],
    );

    if (outlet.sectionError) return <SizeTokensPlaceholder failed onRetry={outlet.reload} />;
    if (!context || !outlet.designSystem || !outlet.theme || outlet.sectionPending) return <SizeTokensPlaceholder />;

    return (
        <SizeTokensScreen
            key={`${context.projectId}:${context.designSystemId}:${context.tenantId}:${context.versionId ?? ''}`}
            context={context}
            designSystem={outlet.designSystem}
            theme={outlet.theme}
            palette={outlet.palette ?? null}
            rerender={outlet.rerender}
            reload={outlet.reload}
            changedTokenNames={outlet.changedTokenNames}
        />
    );
};
