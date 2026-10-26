package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadContext
import com.dsbuilder.ds.core.application.ModelReadSelection
import com.dsbuilder.ds.core.application.ModelReadSelectionResolver
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.ResolvedModelRead
import org.jetbrains.exposed.v1.core.IColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Разрешает ресурс и границу внутри текущей JDBC-транзакции. */
class ExposedModelReadSelectionResolver : ModelReadSelectionResolver {
    override suspend fun resolve(context: DsRequestContext, target: ModelReadTarget): DsResult<ResolvedModelRead> {
        val selection = when (
            val parsed = ModelReadSelection.parse(
                listOfNotNull(context.version),
                listOfNotNull(context.versionId?.toString()),
            )
        ) {
            is DsResult.Failure -> return parsed
            is DsResult.Success -> parsed.value
        }
        val owner = owner(context, target) ?: return DsResult.Failure(DsFailure.NotFound)
        return if (target.kind == ModelReadTarget.Kind.VERSION_HISTORY) {
            DsResult.Success(
                ResolvedModelRead(
                    context.copy(
                        version = null,
                        versionId = null,
                        readQuery = context.readQuery.copy(scope = "${context.projectId.value}/$owner/history"),
                    ),
                    ModelReadContext(owner),
                ),
            )
        } else {
            resolveBoundary(context, owner, selection)
        }
    }

    private fun resolveBoundary(
        context: DsRequestContext,
        owner: UUID,
        selection: ModelReadSelection,
    ): DsResult<ResolvedModelRead> {
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>(UUIDColumnType() to owner)
        val predicate = when (selection) {
            ModelReadSelection.Draft -> "status = 'draft'"
            is ModelReadSelection.Published -> {
                args += TextColumnType() to selection.version
                "status = 'published' AND snapshot IS NULL AND version = ?"
            }
            is ModelReadSelection.ById -> {
                args += UUIDColumnType() to selection.id
                "status = 'published' AND snapshot IS NULL AND id = ?"
            }
        }
        val boundary = TransactionManager.current().exec(
            "SELECT id, version FROM design_system_versions WHERE design_system_id = ? AND $predicate", args,
        ) { rows ->
            if (rows.next()) rows.getObject("id", UUID::class.java) to rows.getString("version") else null
        } ?: return DsResult.Failure(DsFailure.NotFound)
        val metadata = if (selection == ModelReadSelection.Draft) {
            ModelReadContext(
                owner,
                "draft",
                draftId = boundary.first,
                draftRevision = resolvedDraftRevision(boundary.first),
            )
        } else {
            ModelReadContext(owner, boundary.second, versionId = boundary.first)
        }
        return DsResult.Success(
            ResolvedModelRead(
                context.copy(
                    versionId = metadata.versionId,
                    version = null,
                    readQuery = context.readQuery.copy(
                        version = null,
                        scope = "${context.projectId.value}/$owner/${metadata.versionId ?: metadata.draftId}",
                    ),
                ),
                metadata,
            ),
        )
    }

    private fun owner(context: DsRequestContext, target: ModelReadTarget): UUID? {
        val resource = when (target.kind) {
            ModelReadTarget.Kind.DESIGN_SYSTEM, ModelReadTarget.Kind.VERSION_HISTORY ->
                "SELECT id AS design_system_id FROM design_systems WHERE id = ?"
            ModelReadTarget.Kind.TOKEN -> "SELECT design_system_id FROM tokens WHERE id = ?"
            ModelReadTarget.Kind.TENANT -> "SELECT design_system_id FROM tenants WHERE id = ?"
            ModelReadTarget.Kind.APPEARANCE -> "SELECT design_system_id FROM appearances WHERE id = ?"
        }
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>(UUIDColumnType() to target.id)
        val accessible = if (context.principal.systemAdmin) {
            "TRUE"
        } else {
            args += TextColumnType() to context.projectId.value
            "(system.project_id = ? OR system.project_id IS NULL)"
        }
        return TransactionManager.current().exec(
            "SELECT system.id FROM ($resource) resource " +
                "JOIN design_systems system ON system.id = resource.design_system_id WHERE $accessible",
            args,
        ) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) else null }
    }
}
