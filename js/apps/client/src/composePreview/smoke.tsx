import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { ComposePreviewFrame } from './ComposePreviewFrame';
import { createBasicButtonPreviewPayload } from './basicButtonFixture';
import { getComposePreviewPluginUrl } from './config';

const SmokeApp = () => {
    const [text, setText] = useState('First render');
    const payload = useMemo(() => createBasicButtonPreviewPayload({ text }), [text]);
    const pluginUrl = getComposePreviewPluginUrl();

    if (!pluginUrl) return <p role="alert">VITE_COMPOSE_PREVIEW_PLUGIN_URL is not configured</p>;

    return (
        <main style={{ width: 600, height: 400 }}>
            <button type="button" onClick={() => setText('Second render')}>
                Send second full payload
            </button>
            <ComposePreviewFrame pluginUrl={pluginUrl} payload={payload} />
        </main>
    );
};

createRoot(document.getElementById('root')!).render(<SmokeApp />);
