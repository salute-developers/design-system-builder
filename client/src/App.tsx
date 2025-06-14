import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';

import { ComponentEditor, ComponentSelector, Demo, Generate, Main, TokensEditor } from './_new/pages';
import { DesignSystem } from './designSystem';

function App() {
    const [designSystem, setDesignSystem] = useState(() => new DesignSystem({}));

    console.log('designSystem', designSystem);

    return (
        <BrowserRouter>
            <Routes>
                <Route index element={<Main designSystem={designSystem} setDesignSystem={setDesignSystem} />} />
                {/* TODO: сделать загрузку дизайн системы по данным из url */}
                <Route path="/:designSystemName/:designSystemVersion">
                    <Route path="theme" element={<TokensEditor designSystem={designSystem} />} />
                    <Route path="components">
                        <Route index element={<ComponentSelector designSystem={designSystem} />} />
                        <Route path=":component" element={<ComponentEditor designSystem={designSystem} />} />
                    </Route>
                    <Route path="generate" element={<Generate designSystem={designSystem} />} />
                </Route>
                <Route path="demo" element={<Demo />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
