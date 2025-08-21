import createApp from './app';
import * as path from 'path';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;

// Storage directory (configurable for testing)
const STORAGE_DIR = process.env.TEST_STORAGE_DIR || path.join(__dirname, '../storage');

// Create app instance
const app = createApp(STORAGE_DIR);

app.listen(PORT, () => {
    console.log(`🚀 Client proxy server running on port ${PORT}`);
    console.log(`📁 Storage directory: ${STORAGE_DIR}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
