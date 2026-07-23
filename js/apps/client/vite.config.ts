import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

const base = process.env.BASE_URL || '/';

// https://vite.dev/config/
export default defineConfig({
    server: {
        // TODO: необходимость в этом появилось после того, как я установил пакет
        watch: {
            usePolling: true,
        },
    },
    base,
    plugins: [react()],
    define: {
        'process.env': {},
    },
    preview: {
        allowedHosts: true,
    },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        setupFiles: './src/test/setup.ts',
        restoreMocks: true,
    },
});
