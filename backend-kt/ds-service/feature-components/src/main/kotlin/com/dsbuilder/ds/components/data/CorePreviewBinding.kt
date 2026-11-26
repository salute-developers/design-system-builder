package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.NewPluginBuild
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager

/** Связывает проверенную сборку и однократно заполняет ожидающие слоты того же Core. */
internal fun corePreviewReleaseId(build: NewPluginBuild): java.util.UUID = TransactionManager.current().exec(
    "SELECT id FROM core_releases WHERE library_id = ? AND platform::text = ? AND version = ? " +
        "AND meta_sha256 = ? AND provenance = 'imported'",
    listOf(build.coreRelease.libraryId, build.platform, build.libraryVersion, build.metaSha256)
        .map { TextColumnType() to it },
) { rows ->
    check(rows.next()) { "Preview requires its exact imported Core release" }
    rows.getObject(1, java.util.UUID::class.java)
} ?: error("Preview requires its exact imported Core release")

/** Вызывается под общим для регистрации/исторической фиксации барьером конкретного релиза. */
internal fun bindCorePreviewBuild(build: NewPluginBuild, release: java.util.UUID) {
    val tx = TransactionManager.current()
    tx.exec(
        "INSERT INTO core_release_preview_builds(build_id, release_id) VALUES (?, ?)",
        listOf(TextColumnType() to build.buildId, org.jetbrains.exposed.v1.core.UUIDColumnType() to release),
    )
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
    "SELECT DISTINCT build_id FROM design_system_version_preview_builds WHERE build_id IS NOT NULL " +
        "UNION SELECT preview.build_id FROM core_release_preview_builds preview " +
        "JOIN design_system_version_core_releases binding ON binding.release_id = preview.release_id " +
        "JOIN design_system_versions boundary ON boundary.id = binding.version_id WHERE boundary.status = 'draft' " +
        "AND preview.build_id = (SELECT selected.build_id FROM core_release_preview_builds selected " +
        "WHERE selected.release_id = binding.release_id " +
        "ORDER BY selected.registered_at DESC, selected.build_id DESC LIMIT 1)",
) { rows -> buildSet { while (rows.next()) add(rows.getString(1)) } }.orEmpty()
