import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        environmentOptions: {
            jsdom: { url: 'http://localhost:3011/', pretendToBeVisual: true },
        },
        include: ['test/**/*.{test,spec}.{ts,tsx}'],
        setupFiles: ['./test/setup.ts'],
        restoreMocks: true,
        testTimeout: 20000,
    },
});
