import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        environmentOptions: {
            jsdom: { url: 'http://localhost/' },
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        setupFiles: ['./src/test/setup.ts'],
        restoreMocks: true,
        css: true,
        // Тяжёлые страницы (палитра, проекты) на CI-раннере рендерятся дольше 5 с по умолчанию.
        testTimeout: 20000,
        hookTimeout: 20000,
    },
});
