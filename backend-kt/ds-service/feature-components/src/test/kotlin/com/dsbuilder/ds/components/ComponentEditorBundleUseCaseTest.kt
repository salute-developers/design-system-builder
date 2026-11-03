package com.dsbuilder.ds.components

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.application.ComponentEditorBundleRepository
import com.dsbuilder.ds.components.application.ComponentEditorBundleRepository.LoadAttempt
import com.dsbuilder.ds.components.application.GetComponentEditorBundleUseCase
import com.dsbuilder.ds.components.domain.Component
import com.dsbuilder.ds.components.domain.ComponentConfigPackage
import com.dsbuilder.ds.components.domain.ComponentEditorBundle
import com.dsbuilder.ds.components.domain.ComponentEditorPlatform
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import kotlinx.coroutines.runBlocking
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

/** Права, сокрытие и передача параметров сценария чтения пакета компонента для редактора. */
class ComponentEditorBundleUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val designSystemId = UUID.fromString("2df66b98-13b7-46d9-b611-43459e4f4367")
    private val componentId = UUID.fromString("0b8c6c2e-3f7f-4a43-9d0c-6c5a3e2f9a10")

    @Test
    fun `returns the bundle and passes platform design system and component to the repository`() = runBlocking {
        val repository = RecordingBundleRepository(LoadAttempt.Success(bundle("compose")))

        val result = useCase(repository).execute(
            context(user()),
            designSystemId,
            componentId,
            ComponentEditorPlatform.COMPOSE,
        )

        assertEquals(bundle("compose"), assertIs<DsResult.Success<ComponentEditorBundle>>(result).value)
        assertEquals(ProjectId("project-1"), repository.projectId)
        assertEquals(designSystemId, repository.designSystemId)
        assertEquals(componentId, repository.componentId)
        assertEquals(ComponentEditorPlatform.COMPOSE, repository.platform)
    }

    @Test
    fun `reads in one read-only transaction of the context with the selected version`() = runBlocking {
        val transactions = RecordingBundleTransactions()
        val selected = context(user()).copy(versionId = UUID.randomUUID())
        val repository = RecordingBundleRepository(LoadAttempt.Success(bundle("web")))

        val result = GetComponentEditorBundleUseCase(policy, transactions, repository)
            .execute(selected, designSystemId, componentId, ComponentEditorPlatform.WEB)

        assertIs<DsResult.Success<*>>(result)
        assertEquals(listOf(selected), transactions.readContexts)
    }

    @Test
    fun `rejects a key without components variations read before touching the repository`() = runBlocking {
        val repository = RecordingBundleRepository(LoadAttempt.Success(bundle("web")))
        val key = ProjectPrincipal(
            type = ProjectActorType.PROJECT_KEY,
            actorId = "key-1",
            projectId = "project-1",
            projectScopes = setOf("components:read"),
        )

        val result = useCase(repository).execute(context(key), designSystemId, componentId, ComponentEditorPlatform.WEB)

        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(result).error)
        assertNull(repository.projectId)
    }

    @Test
    fun `hides a missing bundle and a component of another platform as not found`() = runBlocking {
        val missing = useCase(RecordingBundleRepository(LoadAttempt.NotFound))
            .execute(context(user()), designSystemId, componentId, ComponentEditorPlatform.WEB)
        val foreign = useCase(RecordingBundleRepository(LoadAttempt.Success(bundle("compose"))))
            .execute(context(user()), designSystemId, componentId, ComponentEditorPlatform.WEB)

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(missing).error)
        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(foreign).error)
    }

    @Test
    fun `a failed export is reported like the export route`() = runBlocking {
        val result = useCase(RecordingBundleRepository(LoadAttempt.Failed("not reversible")))
            .execute(context(user()), designSystemId, componentId, ComponentEditorPlatform.WEB)

        assertEquals(
            DsFailure.Unprocessable("Export failed", "not reversible"),
            assertIs<DsResult.Failure>(result).error,
        )
    }

    private fun useCase(repository: ComponentEditorBundleRepository) =
        GetComponentEditorBundleUseCase(policy, RecordingBundleTransactions(), repository)

    private fun bundle(platform: String): ComponentEditorBundle {
        val now = Instant.parse("2026-01-01T00:00:00Z")
        return ComponentEditorBundle(
            component = Component(componentId, "Button", platform, null, now, now),
            appearances = emptyList(),
            export = ComponentConfigPackage(ComponentConfigPackage.Meta("alpha", "draft"), emptyList(), emptyList()),
            properties = emptyList(),
            platformParams = emptyList(),
            propertyVariations = emptyList(),
            variations = emptyList(),
            styles = emptyList(),
            webAdapter = null,
            dependencies = emptyList(),
            dependencyComponents = emptyList(),
        )
    }

    private fun user() = ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "viewer")

    private fun context(principal: ProjectPrincipal) = DsRequestContext(principal, "correlation-1")
}

private class RecordingBundleTransactions : TransactionRunner {
    val readContexts = mutableListOf<DsRequestContext>()
    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(context: DsRequestContext, block: suspend () -> DsResult<T>): DsResult<T> {
        readContexts += context
        return block()
    }
}

private class RecordingBundleRepository(private val attempt: LoadAttempt) : ComponentEditorBundleRepository {
    var projectId: ProjectId? = null
    var designSystemId: UUID? = null
    var componentId: UUID? = null
    var platform: ComponentEditorPlatform? = null

    override suspend fun load(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: UUID,
        componentId: UUID,
        platform: ComponentEditorPlatform,
    ): LoadAttempt {
        this.projectId = projectId
        this.designSystemId = designSystemId
        this.componentId = componentId
        this.platform = platform
        return attempt
    }
}
