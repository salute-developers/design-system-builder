import { createRoot } from 'react-dom/client';
import { createGlobalStyle } from 'styled-components';
import { plasma_infra__dark } from '@salutejs/plasma-themes';

import './App.css';
import App from './App.tsx';

const DarkThemeStyle = createGlobalStyle(plasma_infra__dark);

createRoot(document.getElementById('root')!).render(
    <>
        <DarkThemeStyle />
        <App />
    </>,
);
