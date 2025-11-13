import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import {
    Projects,
    Home,
    Colors,
    Shapes,
    Typography,
    Components,
    Main,
    Overview,
} from './pages';

const getBaseName = () => {
    const { pathname } = window.location;

    const prMatch = pathname.match(/^\/pr\/design-system-builder-pr-\d+/);
    if (prMatch) {
        return prMatch[0];
    }

    if (pathname.startsWith('/design-system-builder')) {
        return '/design-system-builder';
    }

    return '/';
};

function App() {
    return (
        <Router basename={getBaseName()}>
            <Routes>
                <Route path="/" element={<Main />}>
                    <Route path="/" element={<Home />}>
                        <Route index element={<Projects />} />
                    </Route>
                    <Route path=":designSystemName/:designSystemVersion">
                        <Route path="overview" element={<Overview />} />
                        <Route path="colors" element={<Colors />} />
                        <Route path="shapes" element={<Shapes />} />
                        <Route path="typography" element={<Typography />} />
                        <Route path="components" element={<Components />} />
                    </Route>
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
