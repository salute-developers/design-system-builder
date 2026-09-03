import { execSync } from "node:child_process";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { TEST_DATABASE_URL } from "./database";

/**
 * Готовит тестовую базу один раз на прогон: создаёт, если её нет, и накатывает миграции.
 *
 * Схема берётся из `drizzle/`, а не из `schema.ts`: тесты должны видеть ту же базу, что
 * получит рабочий контур, включая триггеры, которых в `schema.ts` нет.
 */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const databaseName = url.pathname.slice(1);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const [existing] = await admin`select 1 from pg_database where datname = ${databaseName}`;
    if (!existing) {
      await admin.unsafe(`create database "${databaseName}"`);
    }
  } finally {
    await admin.end();
  }

  const client = postgres(TEST_DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }

  void execSync;
}
