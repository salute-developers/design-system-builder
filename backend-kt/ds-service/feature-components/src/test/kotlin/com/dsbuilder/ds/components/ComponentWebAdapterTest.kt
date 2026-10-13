package com.dsbuilder.ds.components

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.application.ComponentWebAdapterRepository
import com.dsbuilder.ds.components.application.GetComponentWebAdapterUseCase
import com.dsbuilder.ds.components.domain.ComponentWebAdapterEntry
import com.dsbuilder.ds.components.presentation.ComponentWebAdapterEntryResponse
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Доступ к web-адаптеру и контракт его ответа. */
class ComponentWebAdapterTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val json = Json { explicitNulls = true }
    private val designSystemId = UUID.fromString("2df66b98-13b7-46d9-b611-43459e4f4367")

    @Test
    fun `returns entries of an accessible design system`() = runBlocking {
        val repository = RecordingWebAdapterRepository(listOf(entry()))

        val result = useCase(repository).execute(context(userPrincipal("viewer")), designSystemId)

        assertEquals(listOf(entry()), assertIs<DsResult.Success<List<ComponentWebAdapterEntry>>>(result).value)
        assertEquals(ProjectId("project-1"), repository.projectId)
        assertEquals(designSystemId, repository.designSystemId)
    }

    @Test
    fun `hides an inaccessible design system as not found`() = runBlocking {
        val result = useCase(RecordingWebAdapterRepository(null))
            .execute(context(userPrincipal("viewer")), designSystemId)

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(result).error)
    }

    @Test
    fun `rejects a key without components read before touching the repository`() = runBlocking {
        val repository = RecordingWebAdapterRepository(listOf(entry()))
        val key = ProjectPrincipal(
            type = ProjectActorType.PROJECT_KEY,
            actorId = "key-1",
            projectId = "project-1",
            projectScopes = setOf("tokens:read"),
        )

        val result = useCase(repository).execute(context(key), designSystemId)

        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(result).error)
        assertEquals(null, repository.projectId)
    }

    @Test
    fun `response omits empty optional fields`() {
        val bare = entry().copy(description = null, compose = emptyList(), styles = emptyMap())

        assertEquals(
            """{"componentName":"tabs","name":"Tabs"}""",
            json.encodeToString(ComponentWebAdapterEntryResponse.from(bare)),
        )
    }

    @Test
    fun `response keeps description compose and style templates`() {
        assertEquals(
            """{"componentName":"tabs","name":"Tabs","description":"Вкладки","compose":["tab-item"],""" +
                """"styles":{"default":{"templates":{"shape":{"tabsRadius":"0 $1"}}}}}""",
            json.encodeToString(ComponentWebAdapterEntryResponse.from(entry())),
        )
    }

    private fun useCase(repository: ComponentWebAdapterRepository) =
        GetComponentWebAdapterUseCase(policy, ImmediateWebAdapterTransactions(), repository)

    private fun entry() = ComponentWebAdapterEntry(
        componentName = "tabs",
        name = "Tabs",
        description = "Вкладки",
        compose = listOf("tab-item"),
        styles = mapOf("default" to mapOf("shape" to mapOf("tabsRadius" to "0 $1"))),
    )

    private fun userPrincipal(role: String) = ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role)

    private fun context(principal: ProjectPrincipal) = DsRequestContext(principal, "correlation-1")
}

private class ImmediateWebAdapterTransactions : TransactionRunner {
    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
}

private class RecordingWebAdapterRepository(
    private val entries: List<ComponentWebAdapterEntry>?,
) : ComponentWebAdapterRepository {
    var projectId: ProjectId? = null
    var designSystemId: UUID? = null

    override suspend fun load(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
    ): List<ComponentWebAdapterEntry>? {
        this.projectId = projectId
        this.designSystemId = designSystemId
        return entries
    }
}
