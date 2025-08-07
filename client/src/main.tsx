import { createRoot } from 'react-dom/client';
import { createGlobalStyle } from 'styled-components';
import { plasma_b2c__dark } from '@salutejs/plasma-themes';

import './App.css';
import App from './App.tsx';

const DarkThemeStyle = createGlobalStyle(plasma_b2c__dark);

createRoot(document.getElementById('root')!).render(
    <>
        <DarkThemeStyle />
        <App />
    </>,
);
