import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Figma загружает окно плагина одним HTML-файлом, поэтому скрипты и стили встраиваются в него.
export default defineConfig({
    root: 'src/ui',
    plugins: [react(), viteSingleFile()],
    build: {
        outDir: '../../dist',
        emptyOutDir: false,
        rollupOptions: { input: 'src/ui/ui.html' },
    },
});
