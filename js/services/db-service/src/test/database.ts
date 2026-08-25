import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { TransactionRollbackError } from "drizzle-orm";
import * as schema from "../db/schema";

/**
 * Адрес тестовой базы.
 *
 * Отдельная переменная, а не `DATABASE_URL`: тесты сносят и пересоздают базу, и указать
 * им рабочую означало бы потерять локальные данные по невнимательности.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/db_service_test";

export const testClient = postgres(TEST_DATABASE_URL, { max: 1 });

export const testDb = drizzle(testClient, { schema });

export type TestTx = Parameters<Parameters<typeof testDb.transaction>[0]>[0];

/**
 * Выполняет тело в транзакции и откатывает её, чем бы оно ни кончилось.
 *
 * База между тестами не чистится вручную и не пересоздаётся: откат дешевле и надёжнее,
 * а порядок тестов перестаёт влиять на результат.
 */
export const withRollback = async <T>(body: (tx: TestTx) => Promise<T>): Promise<T> => {
  let result!: T;
  try {
    await testDb.transaction(async (tx) => {
      result = await body(tx);
      tx.rollback();
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) throw error;
  }
  return result;
};
