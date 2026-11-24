package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.PluginBuildRepository
import com.dsbuilder.ds.components.domain.NewPluginBuild
import com.dsbuilder.ds.components.domain.PluginBuild
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import java.util.UUID

/** Реестр билдов плагина поверх Exposed; работает в транзакции вызывающего кода. */
internal class ExposedPluginBuildRepository : PluginBuildRepository {
    override suspend fun lockPublications() {
        // The registry lock serializes publications. Each read after waiting must see the winning commit,
        // before any storage write: a SERIALIZABLE snapshot taken while waiting would still see the old registry.
        TransactionManager.current().exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
        TransactionManager.current().exec(
            "SELECT pg_advisory_xact_lock(?)",
            listOf(LongColumnType() to PUBLICATION_LOCK_KEY),
        )
    }

    override suspend fun find(buildId: String): PluginBuild? =
        PluginBuildsTable.selectAll().where { PluginBuildsTable.buildId eq buildId }.singleOrNull()?.toBuild()

    override suspend fun active(platform: String): PluginBuild? {
        val db = platform.toDb()
        return PluginBuildsTable.selectAll()
            .where { (PluginBuildsTable.platform eq db) and (PluginBuildsTable.active eq true) }
            .singleOrNull()?.toBuild()
    }

    override suspend fun selected(platform: String, versionId: UUID?): PluginBuild? {
        val id = if (versionId == null) {
            TransactionManager.current().exec(
                "SELECT b.build_id FROM core_release_preview_builds b " +
                    "WHERE b.release_id = ds_selected_core_release(?::component_platform) " +
                    "ORDER BY b.registered_at DESC, b.build_id DESC LIMIT 1",
                listOf(TextColumnType() to platform),
            ) { rows -> if (rows.next()) rows.getString(1) else null }
        } else {
            TransactionManager.current().exec(
                "SELECT build_id FROM design_system_version_preview_builds WHERE version_id = ? AND platform::text = ?",
                listOf(UUIDColumnType() to versionId, TextColumnType() to platform),
            ) { rows -> if (rows.next()) rows.getString(1) else null }
        }
        return id?.let { find(it) }
    }

    override suspend fun listByRecency(platform: String): List<PluginBuild> {
        val db = platform.toDb()
        return PluginBuildsTable.selectAll().where { PluginBuildsTable.platform eq db }
            .orderBy(PluginBuildsTable.publishedAt to SortOrder.DESC, PluginBuildsTable.buildId to SortOrder.DESC)
            .map { it.toBuild() }
    }

    override suspend fun insertActive(build: NewPluginBuild): PluginBuild {
        val db = build.platform.toDb()
        val release = corePreviewReleaseId(build)
        com.dsbuilder.ds.core.data.CorePreviewLocks.lockRegistration(release)
        deactivateOthers(db, build.buildId)
        PluginBuildsTable.insert {
            it[buildId] = build.buildId
            it[platform] = db
            it[libraryVersion] = build.libraryVersion
            it[metaSha256] = build.metaSha256
            it[commitSha] = build.commit
            it[protocolVersion] = build.protocolVersion
            it[zipSha256] = build.zipSha256
            it[storageKey] = build.storageKey
            it[sizeBytes] = build.sizeBytes
            it[fileCount] = build.fileCount
            it[publishedBy] = build.publishedBy
            it[publishedAt] = Instant.now()
            it[active] = true
        }
        bindCorePreviewBuild(build, release)
        return requireNotNull(find(build.buildId))
    }

    override suspend fun validateReplacement(build: NewPluginBuild): DsResult<Unit> {
        val tx = TransactionManager.current()
        val bound = tx.exec(
            "SELECT r.id, r.channel, r.library_id = ? AND r.platform::text = ? AND r.version = ? " +
                "AND r.meta_sha256 = ? AS matches FROM core_release_preview_builds preview " +
                "JOIN core_releases r ON r.id = preview.release_id WHERE preview.build_id = ?",
            listOf(build.coreRelease.libraryId, build.platform, build.libraryVersion, build.metaSha256, build.buildId)
                .map { TextColumnType() to it },
        ) { rows ->
            if (rows.next()) {
                Triple(
                    rows.getObject(1, UUID::class.java),
                    rows.getString(2),
                    rows.getBoolean(3),
                )
            } else {
                null
            }
        }
        if (bound == null || bound.second != "dev" || !bound.third) {
            return DsResult.Failure(
                DsFailure.Conflict("DEV_PREVIEW_REPLACEMENT_FORBIDDEN"),
            )
        }
        com.dsbuilder.ds.core.data.CorePreviewLocks.lockRegistration(bound.first)
        return if (isVersionPinned(build.buildId)) {
            DsResult.Failure(
                DsFailure.Conflict("PREVIEW_BUILD_PINNED"),
            )
        } else {
            DsResult.Success(Unit)
        }
    }

    override suspend fun isVersionPinned(buildId: String): Boolean = TransactionManager.current().exec(
        "SELECT EXISTS(SELECT 1 FROM design_system_version_preview_builds WHERE build_id = ?)",
        listOf(TextColumnType() to buildId),
    ) { rows -> rows.next() && rows.getBoolean(1) } ?: true

    override suspend fun replaceActive(build: NewPluginBuild): PluginBuild {
        deactivateOthers(build.platform.toDb(), build.buildId)
        PluginBuildsTable.update({ PluginBuildsTable.buildId eq build.buildId }) {
            it[zipSha256] = build.zipSha256
            it[storageKey] = build.storageKey
            it[sizeBytes] = build.sizeBytes
            it[fileCount] = build.fileCount
            it[publishedBy] = build.publishedBy
            it[publishedAt] = Instant.now()
            it[active] = true
        }
        TransactionManager.current().exec(
            "UPDATE core_release_preview_builds SET registered_at = now() WHERE build_id = ?",
            listOf(TextColumnType() to build.buildId),
        )
        return requireNotNull(find(build.buildId))
    }

    override suspend fun activate(buildId: String): PluginBuild {
        val existing = requireNotNull(find(buildId)) { "Plugin build $buildId is not registered" }
        val db = existing.platform.toDb()
        deactivateOthers(db, buildId)
        PluginBuildsTable.update({ PluginBuildsTable.buildId eq buildId }) { it[active] = true }
        return requireNotNull(find(buildId))
    }

    override suspend fun pinnedBuildIds(): Set<String> = pinnedCorePreviewBuildIds()

    override suspend fun deleteIfUnpinned(buildId: String): Boolean {
        val release = TransactionManager.current().exec(
            "SELECT release_id FROM core_release_preview_builds WHERE build_id = ?",
            listOf(TextColumnType() to buildId),
        ) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) else null }
        release?.let(com.dsbuilder.ds.core.data.CorePreviewLocks::lockRegistration)
        if (buildId in pinnedBuildIds()) return false
        delete(buildId)
        return true
    }

    override suspend fun delete(buildId: String) {
        PluginBuildsTable.deleteWhere { PluginBuildsTable.buildId eq buildId }
    }

    private fun deactivateOthers(platform: ComponentPlatformDb, keep: String) {
        PluginBuildsTable.update(
            {
                (PluginBuildsTable.platform eq platform) and
                    (PluginBuildsTable.active eq true) and
                    (PluginBuildsTable.buildId neq keep)
            },
        ) { it[active] = false }
    }

    private fun String.toDb() = requireNotNull(ComponentPlatformDb.fromWire(this)) { "Unknown platform $this" }

    private fun ResultRow.toBuild() = PluginBuild(
        buildId = this[PluginBuildsTable.buildId],
        platform = this[PluginBuildsTable.platform].wireValue,
        libraryVersion = this[PluginBuildsTable.libraryVersion],
        metaSha256 = this[PluginBuildsTable.metaSha256],
        commit = this[PluginBuildsTable.commitSha],
        protocolVersion = this[PluginBuildsTable.protocolVersion],
        zipSha256 = this[PluginBuildsTable.zipSha256],
        storageKey = this[PluginBuildsTable.storageKey] ?: this[PluginBuildsTable.buildId],
        sizeBytes = this[PluginBuildsTable.sizeBytes],
        fileCount = this[PluginBuildsTable.fileCount],
        publishedBy = this[PluginBuildsTable.publishedBy],
        publishedAt = this[PluginBuildsTable.publishedAt],
        active = this[PluginBuildsTable.active],
    )

    private companion object {
        /** Ключ advisory-блокировки реестра билдов плагина (ASCII `compprev`). */
        const val PUBLICATION_LOCK_KEY = 0x636F6D7070726576L
    }
}
