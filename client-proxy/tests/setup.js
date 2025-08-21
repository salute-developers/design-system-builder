const fs = require('fs-extra');
const path = require('path');

// Test storage directory
const TEST_STORAGE_DIR = path.join(__dirname, 'test-storage');

// Clean up test storage before and after each test
beforeEach(async () => {
  await fs.remove(TEST_STORAGE_DIR);
  await fs.ensureDir(TEST_STORAGE_DIR);
});

afterEach(async () => {
  await fs.remove(TEST_STORAGE_DIR);
});

// Override the storage directory for tests
process.env.TEST_STORAGE_DIR = TEST_STORAGE_DIR;
