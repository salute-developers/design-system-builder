import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createAuthEndpoints } from './auth/authEndpoints';
import { createBridge } from './bridge';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
    <App bridge={createBridge()} endpoints={createAuthEndpoints()} />,
);
