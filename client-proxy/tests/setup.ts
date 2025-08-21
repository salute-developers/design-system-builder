import * as path from 'path';

// Test storage directory
const TEST_STORAGE_DIR = path.join(__dirname, 'test-storage');

// Override the storage directory for tests
process.env.TEST_STORAGE_DIR = TEST_STORAGE_DIR;
