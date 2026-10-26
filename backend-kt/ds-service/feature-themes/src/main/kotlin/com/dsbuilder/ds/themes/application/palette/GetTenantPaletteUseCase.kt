package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.palette.ThemePalette
import java.util.UUID

/** Палитра темы: группы, состав, значения, привязки токенов и копия шаблона. */
class GetTenantPaletteUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantPaletteRepository,
) {
    /**
     * Читает палитру без ленивой инициализации. Опубликованная граница доступна только для просмотра.
     */
    suspend fun execute(context: DsRequestContext, tenantId: UUID): DsResult<ThemePalette> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(
                context,
                ModelReadTarget(ModelReadTarget.Kind.TENANT, tenantId),
            ) { selected ->
                val filter = selected.readQuery
                if (!validFilter(filter)) {
                    return@readOnly DsResult.Failure(DsFailure.InvalidRequest("INVALID_QUERY"))
                }
                val writable = selected.versionId == null &&
                    policy.require(context, ProjectScope.TENANTS_WRITE) is DsResult.Success
                repository.snapshot(selected.projectId, tenantId, includeSubjectRevisions = true)?.let { snapshot ->
                    if (!snapshot.hasSystemGroups()) return@readOnly DsResult.Failure(DsFailure.NotFound)
                    val palette = snapshot.palette(tenantId.toString(), writable && snapshot.owned)
                    DsResult.Success(filtered(palette, filter).copy(subjectRevisions = snapshot.subjectRevisions))
                } ?: DsResult.Failure(DsFailure.NotFound)
            }
        }

    private fun validFilter(filter: ModelReadQuery): Boolean {
        val missingType = filter.shade != null && filter.type == null
        val unknownType = filter.type != null && ThemePaletteType.fromWire(filter.type) == null
        return !missingType && !unknownType
    }

    private fun matches(filter: ModelReadQuery, type: String, shade: String?): Boolean =
        (filter.type == null || type == filter.type) && (filter.shade == null || shade == filter.shade)

    private fun matchesGroup(filter: ModelReadQuery, id: String?): Boolean =
        filter.groupId == null || id == filter.groupId

    private fun filtered(palette: ThemePalette, filter: ModelReadQuery): ThemePalette = palette.copy(
        groups = palette.groups.filter { matchesGroup(filter, it.id) }.map { group ->
            group.copy(ramps = group.ramps.filter { matches(filter, it.slot.type.wireValue, it.slot.shade) })
        },
        tokens = palette.tokens.filter { matchesGroup(filter, it.groupId) },
        template = palette.template.filter { matches(filter, it.ramp.type.wireValue, it.ramp.shade) },
        links = palette.links.filter {
            matchesGroup(filter, it.groupId) && matches(filter, it.slot.type.wireValue, it.slot.shade)
        },
    )
}
