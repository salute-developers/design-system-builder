import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { Grayscale, type ThemeConfig } from '@salutejs/plasma-tokens-utils';

import { ComponentEditor, ComponentSelector, DemoComponents, Main, TokensEditor } from './_new/pages';
import { buildDefaultTheme, type Theme } from './themeBuilder';
import { Config } from './componentBuilder';

// TODO: подумать про версионирование
const buildDefaultThemeWithUserConfig = () => {
    const userConfig: ThemeConfig = {
        name: 'test',
        accentColor: {
            dark: '[general.red.500]',
            light: '[general.red.600]',
        },
        grayscale: {
            dark: Grayscale.gray,
            light: Grayscale.gray,
        },
    };

    return buildDefaultTheme(userConfig);
};

function App() {
    // TODO: временная инициализация
    const [theme, setTheme] = useState<Theme | undefined>(buildDefaultThemeWithUserConfig());
    const [components, setComponents] = useState<Config[]>([]);

    return (
        <BrowserRouter>
            <Routes>
                <Route index element={<Main createTheme={setTheme} />} />
                {theme && (
                    <>
                        <Route path="theme" element={<TokensEditor theme={theme} updateTheme={setTheme} />} />
                        <Route path="components">
                            <Route index element={<ComponentSelector components={components} theme={theme} />} />
                            <Route
                                path=":component"
                                element={<ComponentEditor updateComponents={setComponents} theme={theme} />}
                            />
                        </Route>
                        <Route path="/demo" element={<DemoComponents theme={theme} />} />
                    </>
                )}
            </Routes>
        </BrowserRouter>
    );
}

export default App;
