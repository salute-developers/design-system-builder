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
    },
});
