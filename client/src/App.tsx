import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { ComponentEditor, ComponentSelector, Demo, Generate, Main, TokensEditor } from './_new/pages';

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
                <Route index element={<Main />} />
                <Route path=":designSystemName/:designSystemVersion">
                    <Route path="theme" element={<TokensEditor />} />
                    <Route path="components">
                        <Route index element={<ComponentSelector />} />
                        <Route path=":componentName" element={<ComponentEditor />} />
                    </Route>
                    <Route path="generate" element={<Generate />} />
                </Route>
                <Route path="demo" element={<Demo />} />
            </Routes>
        </Router>
    );
}

export default App;
