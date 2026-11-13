import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createBridge } from './bridge';
import { CLIENT_ID, GATEWAY_URL, REALM } from './config';
import { DsBuilderCore } from './core/generated/dsbuilder-core.mjs';
import { createPluginCore } from './core/pluginCore';
import './styles.css';

const bridge = createBridge();
const core = createPluginCore(new DsBuilderCore(GATEWAY_URL, CLIENT_ID, REALM, bridge));

createRoot(document.getElementById('root') as HTMLElement).render(<App bridge={bridge} core={core} />);
