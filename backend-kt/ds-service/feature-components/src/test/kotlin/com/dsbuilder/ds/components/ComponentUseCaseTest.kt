package com.dsbuilder.ds.components

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.application.ComponentRepository
import com.dsbuilder.ds.components.application.CreateComponentUseCase
import com.dsbuilder.ds.components.application.ListComponentsUseCase
import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.components.domain.ComponentDependencyGraph
import com.dsbuilder.ds.components.domain.ComponentPropertySummary
import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Authorization and ownership propagation tests for component use cases. */
class ComponentUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))

    /** Component listing receives the trusted project id. */
    @Test
    fun `list components passes trusted project scope`() = runBlocking {
        val repository = RecordingComponentRepository()

        val result = ListComponentsUseCase(policy, ImmediateTransactions(), repository).execute(ownerContext())

        assertIs<DsResult.Success<List<Component>>>(result)
        assertEquals(ProjectId("project-1"), repository.projectId)
    }

    /** An unowned component cannot be created by an ordinary project member. */
    @Test
    fun `global component creation requires system admin`() = runBlocking {
        val result = CreateComponentUseCase(policy, ImmediateTransactions(), RecordingComponentRepository()).execute(
            ownerContext(),
            ComponentRepository.Create("button", null),
        )

        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(result).error)
    }

    private fun ownerContext() = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "owner"),
        "correlation-1",
    )
}

private class ImmediateTransactions : TransactionRunner {
    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
}

private class RecordingComponentRepository : ComponentRepository {
    var projectId: ProjectId? = null

    override suspend fun listAccessible(projectId: ProjectId, systemAdmin: Boolean): List<Component> {
        this.projectId = projectId
        return emptyList()
    }

    override suspend fun findAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Component? = null
    override suspend fun createGlobal(command: ComponentRepository.Create): Component = error("not called")
    override suspend fun updateAccessible(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
        command: ComponentRepository.Update,
    ): Component? = null

    override suspend fun deleteAccessible(projectId: ProjectId, systemAdmin: Boolean, id: UUID) = false
    override suspend fun variations(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): List<ComponentVariationSummary>? = null

    override suspend fun properties(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): List<ComponentPropertySummary>? = null

    override suspend fun dependencies(
        projectId: ProjectId,
        systemAdmin: Boolean,
        id: UUID,
    ): ComponentDependencyGraph? = null
}
