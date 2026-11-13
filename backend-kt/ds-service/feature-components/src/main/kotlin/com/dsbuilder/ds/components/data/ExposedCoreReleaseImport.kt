package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ImportApiMeta
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Сохранение релиза выполняется в той же транзакции, что и аддитивное пополнение каталога. */
internal class ExposedCoreReleaseImport {
    /** Блокирует текущий указатель даже при первом импорте платформы. */
    fun lock(platform: String) {
        TransactionManager.current().exec(
            "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
            listOf(TextColumnType() to "core-release:$platform"),
        )
        TransactionManager.current().exec(
            "SELECT release_id FROM core_current_releases WHERE platform::text = ? FOR UPDATE",
            listOf(TextColumnType() to platform),
        ) { rows -> while (rows.next()) Unit }
    }

    /** Существующий релиз вместе с точным сравнением исходника и нормализованного состава. */
    fun existing(command: ImportApiMeta, projection: String): Existing? {
        val ref = requireNotNull(command.coreRelease)
        return TransactionManager.current().exec(
            """
                SELECT id, meta_sha256 = ? AND source_meta = decode(?, 'base64') AND normalized_meta = ?::jsonb AS
                matches
                FROM core_releases WHERE library_id = ? AND platform::text = ? AND version = ?
            """.trimIndent(),
            listOf(
                command.metaSha256,
                command.sourceMetaBase64,
                projection,
                ref.libraryId,
                command.platform,
                ref.version,
            )
                .map { TextColumnType() to it },
        ) { rows ->
            if (rows.next()) Existing(rows.getObject("id", UUID::class.java), rows.getBoolean("matches")) else null
        }
    }

    /** Не позволяет двум разным библиотекам делить одно пространство имён платформы. */
    fun libraryMatches(command: ImportApiMeta): Boolean = TransactionManager.current().exec(
        "SELECT NOT EXISTS(SELECT 1 FROM core_releases WHERE platform::text = ? " +
            "AND provenance = 'imported' AND library_id <> ?)",
        listOf(TextColumnType() to command.platform, TextColumnType() to requireNotNull(command.coreRelease).libraryId),
    ) { rows -> rows.next() && rows.getBoolean(1) } ?: false

    /** Записывает новый состав и переключает указатель только после успешного импорта. */
    fun insert(command: ImportApiMeta, projection: String): UUID {
        val ref = requireNotNull(command.coreRelease)
        val id = UUID.randomUUID()
        TransactionManager.current().exec(
            """
                INSERT INTO core_releases(id, library_id, platform, version, source_meta, meta_sha256,
                normalized_meta, provenance)
                VALUES (?, ?, ?::component_platform, ?, decode(?, 'base64'), ?, ?::jsonb, 'imported')
            """.trimIndent(),
            listOf(UUIDColumnType() to id) +
                listOf(
                    ref.libraryId,
                    command.platform,
                    ref.version,
                    command.sourceMetaBase64,
                    command.metaSha256,
                    projection,
                )
                    .map { TextColumnType() to it },
        )
        insertProjection(id)
        TransactionManager.current().exec(
            "INSERT INTO core_current_releases(platform, release_id) VALUES (?::component_platform, ?) " +
                "ON CONFLICT (platform) DO UPDATE SET release_id = EXCLUDED.release_id",
            listOf(TextColumnType() to command.platform, UUIDColumnType() to id),
        )
        return id
    }

    private fun insertProjection(id: UUID) {
        insertComponents(id)
        insertProperties(id)
        insertStates(id)
        insertPlatformParams(id)
        insertStableDependencies(id)
        insertDependencies(id)
    }

    private fun insertComponents(id: UUID) {
        val tx = TransactionManager.current()
        val args = listOf(UUIDColumnType() to id)
        tx.exec(
            """
                INSERT INTO core_release_components
                SELECT r.id, c.id, item->>'name', item->>'description'
                FROM core_releases r CROSS JOIN LATERAL jsonb_array_elements(r.normalized_meta) item
                JOIN components c ON c.name = item->>'name' AND c.platform = r.platform WHERE r.id = ?
            """.trimIndent(),
            args,
        )
    }

    private fun insertProperties(id: UUID) {
        val tx = TransactionManager.current()
        val args = listOf(UUIDColumnType() to id)
        tx.exec(
            """
                INSERT INTO core_release_properties
                SELECT r.id, p.id, c.component_id, prop->>'name', (prop->>'type')::property_type,
                    prop->>'defaultValue', prop->>'description', prop->'componentTargets'
                FROM core_releases r CROSS JOIN LATERAL jsonb_array_elements(r.normalized_meta) item
                JOIN core_release_components c ON c.release_id = r.id AND c.name = item->>'name'
                CROSS JOIN LATERAL jsonb_array_elements(item->'properties') prop
                JOIN properties p ON p.component_id = c.component_id AND p.name = prop->>'name' WHERE r.id = ?
            """.trimIndent(),
            args,
        )
    }

    private fun insertStates(id: UUID) {
        val tx = TransactionManager.current()
        val args = listOf(UUIDColumnType() to id)
        tx.exec(
            """
                INSERT INTO core_release_states
                SELECT r.id, s.id, c.component_id, state, NULL
                FROM core_releases r CROSS JOIN LATERAL jsonb_array_elements(r.normalized_meta) item
                JOIN core_release_components c ON c.release_id = r.id AND c.name = item->>'name'
                CROSS JOIN LATERAL jsonb_array_elements_text(item->'states') state
                JOIN states s ON s.component_id = c.component_id AND s.name = state WHERE r.id = ?
            """.trimIndent(),
            args,
        )
    }

    private fun insertPlatformParams(id: UUID) {
        val tx = TransactionManager.current()
        val args = listOf(UUIDColumnType() to id)
        tx.exec(
            """
                INSERT INTO core_release_platform_params
                SELECT r.id, a.id, p.property_id, alias->>'name',
                    CASE WHEN alias->>'deprecation' = 'unknown' THEN a.deprecated ELSE alias->>'deprecation' =
                    'deprecated' END,
                    CASE WHEN alias->>'deprecation' = 'unknown' THEN a.deprecated_message ELSE alias->>'message' END
                FROM core_releases r CROSS JOIN LATERAL jsonb_array_elements(r.normalized_meta) item
                JOIN core_release_components c ON c.release_id = r.id AND c.name = item->>'name'
                CROSS JOIN LATERAL jsonb_array_elements(item->'properties') prop
                JOIN core_release_properties p ON p.release_id = r.id AND p.component_id = c.component_id AND p.name
                = prop->>'name'
                CROSS JOIN LATERAL jsonb_array_elements(prop->'aliases') alias
                JOIN property_platform_params a ON a.property_id = p.property_id AND a.platform = r.platform AND
                a.name = alias->>'name'
                WHERE r.id = ?
            """.trimIndent(),
            args,
        )
    }

    private fun insertStableDependencies(id: UUID) {
        val tx = TransactionManager.current()
        val args = listOf(UUIDColumnType() to id)
        tx.exec(
            """
                INSERT INTO component_deps(parent_id, child_id, type, "order")
                SELECT p.component_id, c.component_id, 'compose', (dep->>'order')::integer
                FROM core_releases r CROSS JOIN LATERAL jsonb_array_elements(r.normalized_meta) item
                JOIN core_release_components p ON p.release_id = r.id AND p.name = item->>'name'
                CROSS JOIN LATERAL jsonb_array_elements(item->'dependencies') dep
                JOIN core_release_components c ON c.release_id = r.id AND c.name = dep->>'component'
                WHERE r.id = ? ON CONFLICT DO NOTHING
            """.trimIndent(),
            args,
        )
    }

    private fun insertDependencies(id: UUID) {
        val tx = TransactionManager.current()
        val args = listOf(UUIDColumnType() to id)
        tx.exec(
            """
                INSERT INTO core_release_component_dependencies
                SELECT r.id, d.id, p.component_id, c.component_id, 'compose', (dep->>'order')::integer
                FROM core_releases r CROSS JOIN LATERAL jsonb_array_elements(r.normalized_meta) item
                JOIN core_release_components p ON p.release_id = r.id AND p.name = item->>'name'
                CROSS JOIN LATERAL jsonb_array_elements(item->'dependencies') dep
                JOIN core_release_components c ON c.release_id = r.id AND c.name = dep->>'component'
                JOIN component_deps d ON d.parent_id = p.component_id AND d.child_id = c.component_id AND d.type =
                'compose'
                WHERE r.id = ?
            """.trimIndent(),
            args,
        )
    }

    /** Результат сравнения с уже зарегистрированным релизом. */
    data class Existing(val id: UUID, val matches: Boolean)
}
