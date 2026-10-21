package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.PluginBuildRepository
import com.dsbuilder.ds.components.domain.NewPluginBuild
import com.dsbuilder.ds.components.domain.PluginBuild
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant

/** Реестр билдов плагина поверх Exposed; работает в транзакции вызывающего кода. */
internal class ExposedPluginBuildRepository : PluginBuildRepository {
    override suspend fun find(buildId: String): PluginBuild? =
        PluginBuildsTable.selectAll().where { PluginBuildsTable.buildId eq buildId }.singleOrNull()?.toBuild()

    override suspend fun active(platform: String): PluginBuild? {
        val db = platform.toDb()
        return PluginBuildsTable.selectAll()
            .where { (PluginBuildsTable.platform eq db) and (PluginBuildsTable.active eq true) }
            .singleOrNull()?.toBuild()
    }

    override suspend fun listByRecency(platform: String): List<PluginBuild> {
        val db = platform.toDb()
        return PluginBuildsTable.selectAll().where { PluginBuildsTable.platform eq db }
            .orderBy(PluginBuildsTable.publishedAt to SortOrder.DESC, PluginBuildsTable.buildId to SortOrder.DESC)
            .map { it.toBuild() }
    }

    override suspend fun insertActive(build: NewPluginBuild): PluginBuild {
        val db = build.platform.toDb()
        deactivateOthers(db, build.buildId)
        PluginBuildsTable.insert {
            it[buildId] = build.buildId
            it[platform] = db
            it[uikitComposeVersion] = build.uikitComposeVersion
            it[metaSha256] = build.metaSha256
            it[commitSha] = build.commit
            it[protocolVersion] = build.protocolVersion
            it[zipSha256] = build.zipSha256
            it[sizeBytes] = build.sizeBytes
            it[fileCount] = build.fileCount
            it[publishedBy] = build.publishedBy
            it[publishedAt] = Instant.now()
            it[active] = true
        }
        return requireNotNull(find(build.buildId))
    }

    override suspend fun activate(buildId: String): PluginBuild {
        val existing = requireNotNull(find(buildId)) { "Plugin build $buildId is not registered" }
        val db = existing.platform.toDb()
        deactivateOthers(db, buildId)
        PluginBuildsTable.update({ PluginBuildsTable.buildId eq buildId }) { it[active] = true }
        return requireNotNull(find(buildId))
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
        uikitComposeVersion = this[PluginBuildsTable.uikitComposeVersion],
        metaSha256 = this[PluginBuildsTable.metaSha256],
        commit = this[PluginBuildsTable.commitSha],
        protocolVersion = this[PluginBuildsTable.protocolVersion],
        zipSha256 = this[PluginBuildsTable.zipSha256],
        sizeBytes = this[PluginBuildsTable.sizeBytes],
        fileCount = this[PluginBuildsTable.fileCount],
        publishedBy = this[PluginBuildsTable.publishedBy],
        publishedAt = this[PluginBuildsTable.publishedAt],
        active = this[PluginBuildsTable.active],
    )
}
