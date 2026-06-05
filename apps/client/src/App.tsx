import type { ReactNode } from 'react';

import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { Projects, Home, Colors, Shapes, Typography, Components, Main, Overview, Login } from './pages';

import { useOwnerProjectId } from './hooks';
import { authService } from './api';

const getBaseName = () => {
    const { pathname } = window.location;

    const prMatch = pathname.match(/^\/pr\/design-system-builder-pr-\d+/);

    if (prMatch) {
        return prMatch[0];
    }

    if (pathname.startsWith('/design-system-builder/')) {
        return '/design-system-builder/';
    }

    return '/';
};

const ProtectedRoute = () => {
    const isAuthenticated = authService.isAuthenticated();

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
    const isAuthenticated = authService.isAuthenticated();

    return !isAuthenticated ? children : <Navigate to="/" />;
};

const RootRedirect = () => {
    const state = useOwnerProjectId();

    if (state.status === 'loading') {
        return null;
    }

    if (state.status === 'ready') {
        return <Navigate to={`/${state.projectId}`} replace />;
    }
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
                    <Route path="/" element={<Main />}>
                        <Route index element={<RootRedirect />} />
                        <Route path=":designSystemProjectId" element={<Home />}>
                            <Route index element={<Projects />} />
                        </Route>
                        <Route path=":designSystemProjectId/:designSystemName/:designSystemVersion">
                            <Route path="overview" element={<Overview />} />
                            <Route path="colors" element={<Colors />} />
                            <Route path="shapes" element={<Shapes />} />
                            <Route path="typography" element={<Typography />} />
                            <Route path="components" element={<Components />} />
                        </Route>
                    </Route>
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
