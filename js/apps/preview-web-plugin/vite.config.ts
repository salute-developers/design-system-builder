import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Плагин раздаётся с отдельного origin (порт 3011): клиент читает `preview-plugin.json` через fetch, поэтому нужен CORS.
// `base: './'` — относительные пути в сборке, чтобы плагин работал из любого каталога (локально и на стенде).
export default defineConfig({
    base: './',
    plugins: [react()],
    define: {
        'process.env': {},
    },
    server: {
        port: 3011,
        strictPort: true,
        cors: true,
    },
    preview: {
        port: 3011,
        strictPort: true,
        cors: true,
        allowedHosts: true,
    },
});
