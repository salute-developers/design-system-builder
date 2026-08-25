import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/db_service_test";

export default defineConfig({
  test: {
    // Тесты ручек ходят в базу через синглтон `db`, который читает DATABASE_URL при импорте.
    // Подменяем его на тестовый адрес здесь, чтобы прогон физически не мог попасть
    // в рабочую базу, даже если DATABASE_URL в окружении указывает на неё.
    env: { DATABASE_URL: TEST_DATABASE_URL, TEST_DATABASE_URL },
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    // Тесты делят одну базу и полагаются на откат транзакции, поэтому идут по одному.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
