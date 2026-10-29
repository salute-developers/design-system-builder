package com.dsbuilder.ds.designsystems

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.DesignSystemAggregateRepository
import com.dsbuilder.ds.designsystems.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemAppearanceSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemComponentSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemStyleSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemTenantSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemTokenSummary
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Ownership propagation tests for design-system aggregate reads. */
class DesignSystemAggregateUseCaseTest {
    /** The repository receives only the trusted project identifier. */
    @Test
    fun `component aggregate uses trusted project scope`() = runBlocking {
        val repository = RecordingAggregateRepository()
        val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
        val context = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "viewer"),
            "correlation-1",
        )
        val id = DesignSystemId(UUID.randomUUID())

        val result = ListDesignSystemComponentsUseCase(policy, ImmediateTransactions(), repository)
            .execute(context, id, "button")

        assertIs<DsResult.Success<List<DesignSystemComponentSummary>>>(result)
        assertEquals(ProjectId("project-1"), repository.projectId)
        assertEquals(id, repository.designSystemId)
        assertEquals("button", repository.query)
    }
}

private class ImmediateTransactions : TransactionRunner {
    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
}

private class RecordingAggregateRepository : DesignSystemAggregateRepository {
    var projectId: ProjectId? = null
    var designSystemId: DesignSystemId? = null
    var query: String? = null

    override suspend fun listComponents(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        query: String?,
    ): List<DesignSystemComponentSummary> {
        this.projectId = projectId
        this.designSystemId = designSystemId
        this.query = query
        return emptyList()
    }

    override suspend fun listTokens(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        type: String?,
        query: String?,
    ): List<DesignSystemTokenSummary>? = null

    override suspend fun listComponentStyles(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        componentId: UUID,
    ): List<DesignSystemStyleSummary>? = null

    override suspend fun listTenants(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemTenantSummary>? = null

    override suspend fun listAppearances(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemAppearanceSummary>? = null
}
