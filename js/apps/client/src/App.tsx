import type { ReactNode } from 'react';

import { useEffect, useState } from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
    Outlet,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom';

import { Home, Colors, Palette, Shapes, Typography, Components, Main, Login } from './pages';

import { authService, designSystemsApi } from './api';
import { getBaseName } from './utils/baseName';
import {
    CreateDesignSystemPage,
    CreateProjectPage,
    CreateThemePage,
    DesignSystemPage,
    DesignSystemSettingsPage,
    ProjectPage,
    ProjectSettingsPage,
    ProjectsPage,
    ThemeSettingsPage,
} from './pages/workflowPages';

const ProtectedRoute = () => {
    const isAuthenticated = authService.isAuthenticated();

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
    const isAuthenticated = authService.isAuthenticated();

    return !isAuthenticated ? children : <Navigate to="/" />;
};

const LegacyThemeRedirect = () => {
    const { designSystemProjectId = '', designSystemName = '' } = useParams();
    const section = useLocation().pathname.split('/').filter(Boolean).slice(3).join('/') || 'colors';
    const navigate = useNavigate();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        void designSystemsApi
            .list(designSystemProjectId)
            .then(async (systems) => {
                const matches = systems.filter((system) => system.name === designSystemName);
                if (!active) return;
                if (matches.length !== 1) return navigate(`/projects/${designSystemProjectId}`, { replace: true });
                const system = matches[0];
                const tenants = await designSystemsApi.tenants(designSystemProjectId, system.id);
                if (!active) return;
                navigate(
                    tenants.length === 1
                        ? `/projects/${designSystemProjectId}/design-systems/${system.id}/themes/${tenants[0].id}/${section}`
                        : `/projects/${designSystemProjectId}/design-systems/${system.id}`,
                    { replace: true },
                );
            })
            .catch(() => active && setFailed(true));
        return () => {
            active = false;
        };
    }, [designSystemName, designSystemProjectId, navigate, section]);
    return (
        <div role={failed ? 'alert' : 'status'}>{failed ? 'Не удалось открыть старую ссылку' : 'Перенаправляем…'}</div>
    );
};

function App() {
    return (
        <Router basename={getBaseName()}>
            <Routes>
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    }
                />
                <Route path="/" element={<ProtectedRoute />}>
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="projects/new" element={<CreateProjectPage />} />
                    <Route path="projects/:projectId" element={<ProjectPage />} />
                    <Route path="projects/:projectId/settings" element={<ProjectSettingsPage />} />
                    <Route path="projects/:projectId/design-systems/new" element={<CreateDesignSystemPage />} />
                    <Route path="projects/:projectId/design-systems/:designSystemId" element={<DesignSystemPage />} />
                    <Route
                        path="projects/:projectId/design-systems/:designSystemId/settings"
                        element={<DesignSystemSettingsPage />}
                    />
                    <Route
                        path="projects/:projectId/design-systems/:designSystemId/themes/new"
                        element={<CreateThemePage />}
                    />
                    <Route
                        path="projects/:projectId/design-systems/:designSystemId/themes/:tenantId/settings"
                        element={<ThemeSettingsPage />}
                    />
                    <Route
                        path="projects/:projectId/design-systems/:designSystemId/themes/:tenantId"
                        element={<Main />}
                    >
                        <Route index element={<Navigate to="colors" replace />} />
                        <Route path="overview" element={<Navigate to="../colors" replace />} />
                        <Route path="palette" element={<Palette />} />
                        <Route path="colors" element={<Colors />} />
                        <Route path="shapes" element={<Shapes />} />
                        <Route path="typography" element={<Typography />} />
                        <Route path="components/:componentName?" element={<Components />} />
                    </Route>
                    <Route path="/" element={<Main />}>
                        <Route index element={<Navigate to="/projects" replace />} />
                        <Route path=":designSystemProjectId" element={<Home />}>
                            <Route index element={<Navigate to="/projects" replace />} />
                        </Route>
                    </Route>
                    <Route
                        path=":designSystemProjectId/:designSystemName/:designSystemVersion/*"
                        element={<LegacyThemeRedirect />}
                    />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
