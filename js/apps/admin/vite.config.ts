import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.BASE_URL || '/';

export default defineConfig({
    base,
    plugins: [react()],
    define: {
        'process.env': {},
    },
    server: {
        port: 5173,
        allowedHosts: true,
    },
});
