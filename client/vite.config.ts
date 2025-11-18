import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
    server: {
        // TODO: необходимость в этом появилось после того, как я установил пакет
        watch: {
            usePolling: true,
        },
    },
    base: './',
    plugins: [react()],
    define: {
        'process.env': {},
    },
    preview: {
        allowedHosts: true,
    },
});
