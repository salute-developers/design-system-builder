import { BrowserRouter, Routes, Route } from 'react-router';

import { ComponentEditor, ComponentSelector, Demo, Generate, Main, TokensEditor } from './_new/pages';

function App() {
    return (
        <BrowserRouter basename="/design-system-builder">
            <Routes>
                <Route index element={<Main />} />
                <Route path="/:designSystemName/:designSystemVersion">
                    <Route path="theme" element={<TokensEditor />} />
                    <Route path="components">
                        <Route index element={<ComponentSelector />} />
                        <Route path=":componentName" element={<ComponentEditor />} />
                    </Route>
                    <Route path="generate" element={<Generate />} />
                </Route>
                <Route path="demo" element={<Demo />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
