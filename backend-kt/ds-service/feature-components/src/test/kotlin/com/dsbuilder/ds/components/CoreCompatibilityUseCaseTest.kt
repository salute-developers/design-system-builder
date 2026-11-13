package com.dsbuilder.ds.components

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.application.GetCoreCompatibilityUseCase
import com.dsbuilder.ds.core.application.CompatibilityChecker
import com.dsbuilder.ds.core.application.CoreCompatibilityIssue
import com.dsbuilder.ds.core.application.CoreCompatibilityReport
import com.dsbuilder.ds.core.application.CoreProblemLocation
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadContext
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.CoreReleaseRef
import com.dsbuilder.ds.core.domain.CoreReleaseSnapshot
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull

class CoreCompatibilityUseCaseTest {
    private val system = UUID.randomUUID()
    private val component = UUID.randomUUID()
    private val principal = ProjectPrincipal(ProjectActorType.USER, "viewer", "project", "viewer")
    private val context = DsRequestContext(principal, "test", designSystemId = system)
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private var report = CoreCompatibilityReport(
        ModelReadContext(system, draftId = UUID.randomUUID(), draftRevision = 0, coreReleases = listOf(core("A"))),
        listOf(issue("one"), issue("two"), issue("warning", "warning", UUID.randomUUID())),
        2,
        1,
    )
    private var reads = 0
    private val useCase =
        GetCoreCompatibilityUseCase(
            policy,
            DirectCompatibilityTransactions(),
            CompatibilityChecker { _, _, _ ->
                reads++
                report
            },
        )

    @Test
    fun `filtered pages keep global counts and stable issue identifiers`() = runBlocking {
        val first = page(GetCoreCompatibilityUseCase.Query(componentId = component, limit = 1))
        assertEquals(2, first.blockingCount)
        assertEquals(1, first.warningCount)
        assertEquals(listOf("one"), first.items.map { it.issueId })
        val second =
            page(GetCoreCompatibilityUseCase.Query(componentId = component, limit = 1, cursor = first.nextCursor))
        assertEquals(listOf("two"), second.items.map { it.issueId })
        assertEquals(null, second.nextCursor)
        assertEquals(report.items.take(2), first.items + second.items)
    }

    @Test
    fun `Core change invalidates a cursor even when draft revision is unchanged`() = runBlocking {
        val first = page(GetCoreCompatibilityUseCase.Query(limit = 1))
        assertNotNull(first.nextCursor)
        report = report.copy(context = report.context.copy(coreReleases = listOf(core("B"))))
        val result = useCase.execute(context, GetCoreCompatibilityUseCase.Query(limit = 1, cursor = first.nextCursor))
        assertEquals("CORE_CONTEXT_STALE", assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(result).error).code)
    }

    @Test
    fun `filter changes cannot reuse another page and denied callers do not read settings`() = runBlocking {
        val first = page(GetCoreCompatibilityUseCase.Query(limit = 1))
        val result = useCase.execute(
            context,
            GetCoreCompatibilityUseCase.Query(componentId = component, limit = 1, cursor = first.nextCursor),
        )
        assertEquals("CORE_CONTEXT_STALE", assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(result).error).code)
        val before = reads
        val key = ProjectPrincipal(
            ProjectActorType.PERSONAL_ACCESS_TOKEN,
            "key",
            "project",
            "owner",
            personalAccessTokenId = "pat",
            projectScopes = setOf("components:read"),
        )
        val denied = useCase.execute(context.copy(principal = key), GetCoreCompatibilityUseCase.Query())
        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(denied).error)
        assertEquals(before, reads)
    }

    private suspend fun page(query: GetCoreCompatibilityUseCase.Query) =
        assertIs<DsResult.Success<CoreCompatibilityReport>>(useCase.execute(context, query)).value

    private fun core(version: String) = CoreReleaseSnapshot(
        UUID.randomUUID(),
        CoreReleaseRef("uikit", "compose", version),
        "a".repeat(64),
        "imported",
    )

    private fun issue(id: String, severity: String = "blocking", owner: UUID = component) = CoreCompatibilityIssue(
        id,
        "CORE_PROPERTY_REMOVED",
        severity,
        CoreProblemLocation(owner, "Button", "compose", null, null, null, null, null, null),
        null,
        listOf("remove"),
    )
}

private class DirectCompatibilityTransactions : TransactionRunner {
    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> rollback(context: DsRequestContext, block: suspend () -> DsResult<T>) = block()
}
