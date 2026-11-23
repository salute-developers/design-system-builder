package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.CoreSettingsRepository
import com.dsbuilder.ds.components.application.SelectCoreRelease
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.data.lockDraftCoreSelection
import com.dsbuilder.ds.core.domain.CoreReleaseRef
import com.dsbuilder.ds.core.domain.CoreReleaseSnapshot
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Запись выполняется под блокировками черновика вызывающей транзакции. */
internal class ExposedCoreSettingsRepository : CoreSettingsRepository {
    override suspend fun releases(
        platform: String,
        channel: String,
        offset: Int,
        limit: Int,
    ): List<CoreReleaseSnapshot> =
        TransactionManager.current().exec(
            "SELECT id, library_id, platform, version, meta_sha256, provenance, channel FROM core_releases " +
                "WHERE platform::text = ? AND channel = ? " +
                "ORDER BY created_at DESC, id LIMIT ? OFFSET ?",
            listOf(
                TextColumnType() to platform,
                TextColumnType() to channel,
                LongColumnType() to limit.toLong(),
                LongColumnType() to offset.toLong(),
            ),
        ) { rows ->
            buildList {
                while (rows.next()) add(
                    CoreReleaseSnapshot(
                        rows.getObject("id", UUID::class.java),
                        CoreReleaseRef(
                            rows.getString("library_id"),
                            rows.getString("platform"),
                            rows.getString("version"),
                        ),
                        rows.getString("meta_sha256"),
                        rows.getString("provenance"),
                        rows.getString("channel"),
                    ),
                )
            }
        }.orEmpty()

    @Suppress("ReturnCount") // Guards reject the transaction before any binding or revision can be changed.
    override suspend fun select(context: DsRequestContext, command: SelectCoreRelease): DsResult<Unit> {
        lockCoreReleasePlatform(command.platform)
        lockDraftCoreSelection()
        val tx = TransactionManager.current()
        val args = listOf(
            UUIDColumnType() to context.designSystemId,
            TextColumnType() to context.projectId.value,
            org.jetbrains.exposed.v1.core.BooleanColumnType() to context.principal.globalAdmin,
        )
        val draft = tx.exec(
            "SELECT boundary.id, boundary.core_selection_revision FROM design_system_versions boundary " +
                "JOIN design_systems system ON system.id = boundary.design_system_id " +
                "WHERE boundary.design_system_id = ? AND (system.project_id = ? OR ?) " +
                "AND boundary.status = 'draft' FOR UPDATE OF boundary",
            args,
        ) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) to rows.getLong(2) else null }
            ?: return DsResult.Failure(DsFailure.NotFound)
        if (draft.first != command.expectedDraftId || draft.second != command.expectedCoreSelectionRevision) {
            return DsResult.Failure(DsFailure.Conflict("CORE_SELECTION_STALE"))
        }
        val releaseId = if (command.selectionMode == "latest") {
            tx.exec(
                "SELECT id FROM core_releases WHERE platform::text = ? AND channel = ? " +
                    "ORDER BY created_at DESC, id LIMIT 1",
                listOf(TextColumnType() to command.platform, TextColumnType() to command.channel),
            ) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) else null }
        } else {
            tx.exec(
                "SELECT id FROM core_releases WHERE id = ? AND platform::text = ? AND channel = ?",
                listOf(
                    UUIDColumnType() to command.releaseId, TextColumnType() to command.platform,
                    TextColumnType() to command.channel,
                ),
            ) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) else null }
        } ?: return DsResult.Failure(DsFailure.InvalidRequest("invalid_core_selection"))
        com.dsbuilder.ds.core.data.CorePreviewLocks.lockSelection(releaseId)
        val bindingArgs = listOf(UUIDColumnType() to draft.first, TextColumnType() to command.platform)
        val current = tx.exec(
            "SELECT release_id, selection_mode FROM design_system_version_core_releases " +
                "WHERE version_id = ? AND platform::text = ?",
            bindingArgs,
        ) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) to rows.getString(2) else null }
        if (current == (releaseId to command.selectionMode)) return DsResult.Success(Unit)
        tx.exec(
            "INSERT INTO design_system_version_core_releases(version_id, platform, release_id, selection_mode) " +
                "VALUES (?, ?::component_platform, ?, ?) ON CONFLICT (version_id, platform) " +
                "DO UPDATE SET release_id = EXCLUDED.release_id, selection_mode = EXCLUDED.selection_mode",
            bindingArgs + listOf(UUIDColumnType() to releaseId, TextColumnType() to command.selectionMode),
        )
        tx.exec(
            "UPDATE design_system_versions SET core_selection_revision = core_selection_revision + 1 WHERE id = ?",
            listOf(UUIDColumnType() to draft.first),
        )
        return DsResult.Success(Unit)
    }
}
