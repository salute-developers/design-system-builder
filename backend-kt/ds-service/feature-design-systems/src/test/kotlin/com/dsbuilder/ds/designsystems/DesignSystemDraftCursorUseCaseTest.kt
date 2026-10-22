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
import com.dsbuilder.ds.designsystems.application.CreateDesignSystem
import com.dsbuilder.ds.designsystems.application.DesignSystemRepository
import com.dsbuilder.ds.designsystems.application.GetDesignSystemDraftCursorUseCase
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemDraftCursor
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Проверяет отдельное лёгкое чтение курсора SSE. */
class DesignSystemDraftCursorUseCaseTest {
    @Test
    fun `cursor read does not load design system aggregate`() = runBlocking {
        val cursor = DesignSystemDraftCursor(UUID.randomUUID(), 17)
        val repository = CursorOnlyDesignSystemRepository(cursor)
        val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
        val context = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "viewer"),
            "correlation-1",
        )
        val designSystemId = DesignSystemId(UUID.randomUUID())

        val result = GetDesignSystemDraftCursorUseCase(policy, CursorTransactions(), repository)
            .execute(context, designSystemId)

        assertEquals(cursor, assertIs<DsResult.Success<DesignSystemDraftCursor>>(result).value)
        assertEquals(ProjectId("project-1"), repository.projectId)
        assertEquals(designSystemId, repository.designSystemId)
        assertEquals(1, repository.cursorReads)
    }

    @Test
    fun `reconnection shares one cursor read for the same project and design system`() = runBlocking {
        val cursor = DesignSystemDraftCursor(UUID.randomUUID(), 18)
        val repository = CursorOnlyDesignSystemRepository(cursor, delayMillis = 25)
        val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
        val context = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "viewer"),
            "correlation-1",
        )
        val designSystemId = DesignSystemId(UUID.randomUUID())
        val useCase = GetDesignSystemDraftCursorUseCase(policy, CursorTransactions(), repository)

        val results = coroutineScope {
            List(10) {
                async { useCase.reconcile(context, designSystemId, generation = 3) }
            }.awaitAll()
        }

        assertEquals(10, results.filterIsInstance<DsResult.Success<DesignSystemDraftCursor>>().size)
        assertEquals(1, repository.cursorReads)
    }
}

private class CursorTransactions : TransactionRunner {
    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
}

private class CursorOnlyDesignSystemRepository(
    private val cursor: DesignSystemDraftCursor,
    private val delayMillis: Long = 0,
) : DesignSystemRepository {
    var projectId: ProjectId? = null
    var designSystemId: DesignSystemId? = null
    var cursorReads: Int = 0

    override suspend fun findDraftCursorAccessible(
        projectId: ProjectId,
        id: DesignSystemId,
    ): DesignSystemDraftCursor {
        delay(delayMillis)
        this.projectId = projectId
        designSystemId = id
        cursorReads += 1
        return cursor
    }

    override suspend fun listAccessible(projectId: ProjectId): List<DesignSystem> = error("aggregate read")

    override suspend fun findAccessible(projectId: ProjectId, id: DesignSystemId): DesignSystem =
        error("aggregate read")

    override suspend fun createOwned(projectId: ProjectId, command: CreateDesignSystem): DesignSystem =
        error("mutation")

    override suspend fun updateOwned(
        projectId: ProjectId,
        id: DesignSystemId,
        command: UpdateDesignSystem,
    ): DesignSystem = error("mutation")

    override suspend fun deleteOwned(projectId: ProjectId, id: DesignSystemId): Boolean = error("mutation")
}
