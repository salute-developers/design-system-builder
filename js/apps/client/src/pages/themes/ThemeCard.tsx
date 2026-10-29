import { Link } from 'react-router-dom';
import { type ProjectDto } from '../../api';
import { CardMenu } from '../../components/Catalog/Catalog';
import { Visible } from '../../components/rendering';
import { can } from '../../features/projectPermissions';
import type { ThemeProfile, ThemeTenant } from '../../modules/themes/domain/theme';
import { themeProfileLabels } from '../../modules/themes/domain/themeProfiles';

const fallbackPreview = {
    accentLight: '#24C875',
    onAccentLight: '#FFFFFF',
    surfaceLight: '#F5F7F6',
    accentDark: '#35D986',
    surfaceDark: '#1C211E',
};

export const ThemeCard = ({
    projectId,
    theme,
    role,
}: {
    projectId: string;
    theme: ThemeTenant;
    role: ProjectDto['effectiveRole'];
}) => {
    const preview = theme.preview ?? fallbackPreview;

    return (
        <article className="catalog-card clickable-card">
            <Link
                className="catalog-card-link"
                to={`/projects/${projectId}/design-systems/${theme.designSystemId}/themes/${theme.id}/overview`}
            >
                <div className="catalog-cover catalog-cover-theme theme-cover">
                    <div
                        className="theme-pane"
                        style={{ background: preview.surfaceLight, color: preview.accentLight }}
                    >
                        <strong className="theme-pane-mode">Light</strong>
                        <b style={{ background: preview.accentLight }} />
                        <div className="theme-pane-widget">
                            <span className="theme-pane-line is-title" />
                            <span className="theme-pane-line" />
                            <span className="theme-pane-line is-short" />
                            <div className="theme-pane-chart" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>
                        <em style={{ background: preview.accentLight, color: preview.onAccentLight }}>Кнопка</em>
                    </div>
                    <div className="theme-pane" style={{ background: preview.surfaceDark, color: preview.accentDark }}>
                        <strong className="theme-pane-mode">Dark</strong>
                        <b style={{ background: preview.accentDark }} />
                        <div className="theme-pane-widget">
                            <span className="theme-pane-line is-title" />
                            <span className="theme-pane-line" />
                            <span className="theme-pane-line is-short" />
                            <div className="theme-pane-chart" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>
                        <em style={{ background: preview.accentDark }}>Кнопка</em>
                    </div>
                </div>
                <div className="catalog-body">
                    <h2>{theme.name}</h2>
                    <p className="catalog-meta">
                        {themeProfileLabels[theme.colorConfig.profile as ThemeProfile] || 'Custom palette'}
                    </p>
                </div>
            </Link>
            <Visible when={can(role, 'tenants:write')}>
                <CardMenu
                    label={theme.name}
                    settingsTo={`/projects/${projectId}/design-systems/${theme.designSystemId}/themes/${theme.id}/settings`}
                    canDelete={can(role, 'tenants:delete')}
                />
            </Visible>
        </article>
    );
};
