import { defineConfig } from 'vite';

// Основной поток выполняется в песочнице Figma: один файл без модулей.
export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'es2017',
        lib: { entry: 'src/main/code.ts', formats: ['iife'], name: 'dsBuilderPlugin', fileName: () => 'code.js' },
    },
});
