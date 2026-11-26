package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.data.lockDesignSystemPublication
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Общий барьер импорта и выбора платформы, всегда до барьеров отдельных ДС. */
internal fun lockCoreReleasePlatform(platform: String) {
    TransactionManager.current().exec(
        "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
        listOf(TextColumnType() to "core-release:$platform"),
    )
}

/** Продвигает только явно подписанные черновики в той же транзакции, что регистрирует релиз. */
internal fun advanceLatestCoreSelections(platform: String, channel: String) {
    val tx = TransactionManager.current()
    val filters = listOf(TextColumnType() to platform, TextColumnType() to channel)
    val systems = tx.exec(
        "SELECT DISTINCT boundary.design_system_id FROM design_system_version_core_releases binding " +
            "JOIN design_system_versions boundary ON boundary.id = binding.version_id " +
            "JOIN core_releases release ON release.id = binding.release_id " +
            "WHERE boundary.status = 'draft' AND binding.selection_mode = 'latest' " +
            "AND binding.platform::text = ? AND release.channel = ? ORDER BY boundary.design_system_id",
        filters,
    ) { rows -> buildList { while (rows.next()) add(rows.getObject(1, UUID::class.java)) } }.orEmpty()
    for (system in systems) {
        lockDesignSystemPublication(system)
        tx.exec(
            """
            WITH changed AS (
                UPDATE design_system_version_core_releases binding SET release_id = (
                    SELECT id FROM core_releases WHERE platform::text = ? AND channel = ?
                    ORDER BY created_at DESC, id LIMIT 1
                ) FROM design_system_versions boundary, core_releases previous
                WHERE boundary.id = binding.version_id AND boundary.design_system_id = ?
                  AND boundary.status = 'draft' AND binding.selection_mode = 'latest'
                  AND binding.platform::text = ? AND previous.id = binding.release_id AND previous.channel = ?
                  AND binding.release_id IS DISTINCT FROM (
                    SELECT id FROM core_releases WHERE platform::text = ? AND channel = ?
                    ORDER BY created_at DESC, id LIMIT 1
                  ) RETURNING binding.version_id
            ) UPDATE design_system_versions SET core_selection_revision = core_selection_revision + 1
              WHERE id IN (SELECT version_id FROM changed)
            """.trimIndent(),
            filters + listOf(UUIDColumnType() to system) + filters + filters,
        )
    }
}
