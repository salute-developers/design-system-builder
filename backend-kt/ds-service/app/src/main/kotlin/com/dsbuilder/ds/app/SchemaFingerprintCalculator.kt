package com.dsbuilder.ds.app

import java.security.MessageDigest
import java.sql.Connection
import java.sql.ResultSet

/** Computes a deterministic fingerprint of the public PostgreSQL schema. */
class SchemaFingerprintCalculator {
    /** Returns a SHA-256 hash of the relevant PostgreSQL catalog rows. */
    fun calculate(connection: Connection): String {
        val digest = MessageDigest.getInstance("SHA-256")
        QUERIES.forEach { query ->
            connection.prepareStatement(query).use { statement ->
                statement.executeQuery().use { rows ->
                    appendRows(digest, rows)
                }
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun appendRows(digest: MessageDigest, rows: ResultSet) {
        val columnCount = rows.metaData.columnCount
        while (rows.next()) {
            for (index in 1..columnCount) appendValue(digest, rows.getString(index))
            digest.update('\n'.code.toByte())
        }
    }

    private fun appendValue(digest: MessageDigest, rawValue: String?) {
        val value = rawValue ?: NULL_VALUE
        digest.update(value.length.toString().encodeToByteArray())
        digest.update(':'.code.toByte())
        digest.update(value.encodeToByteArray())
        digest.update('|'.code.toByte())
    }

    private companion object {
        const val NULL_VALUE = "<null>"
        val QUERIES = listOf(
            """
            SELECT table_name, column_name, ordinal_position::text, data_type, udt_name,
                   is_nullable, COALESCE(column_default, '<null>')
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history'
            ORDER BY table_name, ordinal_position
            """.trimIndent(),
            """
            SELECT c.relname, con.conname, con.contype::text, pg_get_constraintdef(con.oid, true)
            FROM pg_constraint con
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname <> 'flyway_schema_history'
            ORDER BY c.relname, con.conname
            """.trimIndent(),
            """
            SELECT tablename, indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename <> 'flyway_schema_history'
            ORDER BY tablename, indexname
            """.trimIndent(),
            """
            SELECT p.proname, pg_get_functiondef(p.oid)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
            ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
            """.trimIndent(),
            """
            SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid, true)
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND NOT t.tgisinternal
            ORDER BY c.relname, t.tgname
            """.trimIndent(),
            """
            SELECT t.typname, e.enumsortorder::text, e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            ORDER BY t.typname, e.enumsortorder
            """.trimIndent(),
        )
    }
}
