import { defineConfig } from 'vite';

// Основной поток Pixso: как в Figma, один файл без модулей, но в своём каталоге сборки.
export default defineConfig({
    build: {
        outDir: 'dist-pixso',
        emptyOutDir: true,
        target: 'es2017',
        lib: { entry: 'src/main/pixso.ts', formats: ['iife'], name: 'dsBuilderPlugin', fileName: () => 'code.js' },
    },
});
