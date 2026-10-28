import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type DesignSystemDto, type ProjectDto } from '../../api';
import { CardMenu } from '../../components/Catalog/Catalog';
import { all, choose, Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import { exportDesignSystemFile } from '../../modules/designSystems/application/exportDesignSystemFile';
import { formatThemeCount } from '../../modules/designSystems/domain/designSystem';

export const DesignSystemCard = ({
    projectId,
    system,
    role,
}: {
    projectId: string;
    system: DesignSystemDto;
    role: ProjectDto['effectiveRole'];
}) => {
    const themePreviews = system.themePreviews ?? [];
    const tenantCount = system.tenantCount ?? 0;
    const [exportState, setExportState] = useState<'idle' | 'busy' | 'failed'>('idle');
    const exportLabel = { idle: 'Экспортировать', busy: 'Экспортируем…', failed: 'Ошибка, повторить' }[exportState];
    const exportFile = async () => {
        setExportState('busy');
        try {
            await exportDesignSystemFile(projectId, system);
            setExportState('idle');
            return true;
        } catch {
            setExportState('failed');
            return false;
        }
    };

    return (
        <article className="catalog-card clickable-card">
            <Link className="catalog-card-link" to={`/projects/${projectId}/design-systems/${system.id}`}>
                <div className="catalog-cover catalog-cover-design-system">
                    <div
                        className="catalog-tiles is-design-system"
                        data-count={Math.min(themePreviews.length, 4)}
                        data-testid="design-system-preview"
                    >
                        {choose<ReactNode>(
                            Boolean(themePreviews.length),
                            <img
                                className="catalog-empty-cover"
                                src="/catalog/empty-design-system-preview.svg"
                                alt=""
                            />,
                            themePreviews.slice(0, 4).map((theme) => (
                                <div
                                    className="catalog-tile is-filled"
                                    key={theme.tenantId}
                                    style={{ '--catalog-entity-color': theme.preview.accentLight } as CSSProperties}
                                >
                                    <strong>{theme.name}</strong>
                                    <span>Тема</span>
                                </div>
                            )),
                        )}
                    </div>
                </div>
                <div className="catalog-body">
                    <h2>{system.name}</h2>
                    <p className="catalog-meta">{formatThemeCount(tenantCount)}</p>
                </div>
            </Link>
            <Visible when={can(role, 'designSystems:write')}>
                <CardMenu
                    label={system.name}
                    settingsTo={`/projects/${projectId}/design-systems/${system.id}/settings`}
                    canDelete
                    actions={choose(
                        all(can(role, 'designSystems:export'), tenantCount > 0),
                        [],
                        [{ label: exportLabel, onSelect: exportFile, disabled: exportState === 'busy' }],
                    )}
                />
            </Visible>
        </article>
    );
};
