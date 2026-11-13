package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.domain.DesignSystemAppearanceSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemComponentSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemStyleSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemTenantSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemTokenSummary
import java.util.UUID

/** Project-scoped reads composed below a design-system aggregate. */
interface DesignSystemAggregateRepository {
    /** Performs the listcomponents operation. */
    suspend fun listComponents(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        query: String?,
    ): List<DesignSystemComponentSummary>?

    /** Чтение с фильтрами и необязательной SQL-пагинацией. */
    suspend fun pageComponents(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        query: String?,
        read: ModelReadQuery,
    ): ModelReadItems<DesignSystemComponentSummary>? = listComponents(projectId, designSystemId, query)
        ?.let { ModelReadItems(it) }

    /** Performs the listtokens operation. */
    suspend fun listTokens(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        type: String?,
        query: String?,
    ): List<DesignSystemTokenSummary>?

    /** Чтение с фильтрами и необязательной SQL-пагинацией. */
    suspend fun pageTokens(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        type: String?,
        query: String?,
        read: ModelReadQuery,
    ): ModelReadItems<DesignSystemTokenSummary>? = listTokens(projectId, designSystemId, type, query)
        ?.let { ModelReadItems(it) }

    /** Performs the listcomponentstyles operation. */
    suspend fun listComponentStyles(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        componentId: UUID,
    ): List<DesignSystemStyleSummary>?

    /** Чтение с фильтрами и необязательной SQL-пагинацией. */
    suspend fun pageComponentStyles(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        componentId: UUID,
        read: ModelReadQuery,
    ): ModelReadItems<DesignSystemStyleSummary>? = listComponentStyles(projectId, designSystemId, componentId)
        ?.let { ModelReadItems(it) }

    /** Performs the listtenants operation. */
    suspend fun listTenants(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemTenantSummary>?

    /** Чтение с фильтрами и необязательной SQL-пагинацией. */
    suspend fun pageTenants(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        read: ModelReadQuery,
    ): ModelReadItems<DesignSystemTenantSummary>? = listTenants(projectId, designSystemId)?.let { ModelReadItems(it) }

    /** Performs the listappearances operation. */
    suspend fun listAppearances(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemAppearanceSummary>?
}
