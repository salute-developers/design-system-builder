package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.NewPluginBuild
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

/** Связывает проверенную сборку и однократно заполняет ожидающие слоты того же Core. */
internal fun bindCorePreviewBuild(build: NewPluginBuild) {
    val tx = TransactionManager.current()
    val release = tx.exec(
        """
        INSERT INTO core_release_preview_builds(build_id, release_id)
        SELECT ?, id FROM core_releases WHERE platform::text = ? AND version = ? AND meta_sha256 = ?
          AND provenance = 'imported' RETURNING release_id
        """.trimIndent(),
        listOf(build.buildId, build.platform, build.libraryVersion, build.metaSha256).map { TextColumnType() to it },
        explicitStatementType = StatementType.SELECT,
    ) { rows ->
        check(rows.next()) { "Preview requires an imported Core release" }
        val id = rows.getString(1)
        check(!rows.next()) { "Preview coordinates must identify a single Core release" }
        id
    }
    check(release != null) { "Preview requires an imported Core release" }
    tx.exec(
        """
        UPDATE design_system_version_preview_builds slot SET build_id = binding.build_id
        FROM core_release_preview_builds binding
        WHERE binding.build_id = ? AND slot.release_id = binding.release_id AND slot.build_id IS NULL
        """.trimIndent(),
        listOf(TextColumnType() to build.buildId),
    )
}

/** Закреплённые опубликованными границами файлы нельзя удалять при очистке реестра. */
internal fun pinnedCorePreviewBuildIds(): Set<String> = TransactionManager.current().exec(
    "SELECT DISTINCT build_id FROM design_system_version_preview_builds WHERE build_id IS NOT NULL",
) { rows -> buildSet { while (rows.next()) add(rows.getString(1)) } }.orEmpty()
