package com.dsbuilder.ds.designsystems.application

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

    /** Performs the listtokens operation. */
    suspend fun listTokens(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        type: String?,
        query: String?,
    ): List<DesignSystemTokenSummary>?

    /** Performs the listcomponentstyles operation. */
    suspend fun listComponentStyles(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        componentId: UUID,
    ): List<DesignSystemStyleSummary>?

    /** Performs the listtenants operation. */
    suspend fun listTenants(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemTenantSummary>?

    /** Performs the listappearances operation. */
    suspend fun listAppearances(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemAppearanceSummary>?
}
