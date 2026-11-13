package com.dsbuilder.ds.designsystems

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.DraftChangeBatchRevertResult
import com.dsbuilder.ds.designsystems.application.DraftChangeRepository
import com.dsbuilder.ds.designsystems.application.DraftChangeRevertTarget
import com.dsbuilder.ds.designsystems.application.MAX_REVERT_BATCH_SIZE
import com.dsbuilder.ds.designsystems.application.RevertDraftChangesUseCase
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Пакетный откат журнала: отказы записей с позицией, фиксация транзакции, повторяемость и границы запроса. */
class RevertDraftChangesUseCaseTest {
    private val designSystemId = DesignSystemId(UUID.randomUUID())
    private val first = UUID.randomUUID()
    private val second = UUID.randomUUID()
    private val third = UUID.randomUUID()

    @Test
    fun `passes the batch in the requested order and commits on success`() = runBlocking {
        val journal = FakeJournal()
        val result = useCase(
            journal,
        ).execute(owner(), designSystemId, targets(first to 3, second to 1, third to 7), "k")

        assertIs<DsResult.Success<Unit>>(result)
        assertEquals(listOf(listOf(first, second, third)), journal.batches)
        assertEquals(listOf(true), journal.commits)
    }

    @Test
    fun `a stale entry names its position and the transaction rolls back`() = runBlocking {
        val journal = FakeJournal(DraftChangeBatchRevertResult.Failed(1, DraftChangeRevertResult.Stale(2)))
        val result = useCase(journal).execute(owner(), designSystemId, targets(first to 3, second to 1), "k")

        val conflict = assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(result).error)
        assertEquals("DRAFT_CHANGE_STALE", conflict.code)
        assertEquals(2, conflict.editRevision)
        assertEquals(mapOf("changeIndex" to listOf(1)), conflict.details)
        assertEquals(listOf(false), journal.commits)
    }

    @Test
    fun `dependency conflicts carry the position when it is known`() = runBlocking {
        val entry = FakeJournal(DraftChangeBatchRevertResult.Failed(0, DraftChangeRevertResult.DependencyConflict))
        val conflict = assertIs<DsFailure.Conflict>(
            assertIs<DsResult.Failure>(useCase(entry).execute(owner(), designSystemId, targets(first to 1), "k")).error,
        )
        assertEquals("REVERT_DEPENDENCY_CONFLICT", conflict.code)
        assertEquals(mapOf("changeIndex" to listOf(0)), conflict.details)

        // Ограничения базы относятся к итоговому состоянию пакета, а не к одной записи.
        val whole = FakeJournal(DraftChangeBatchRevertResult.Failed(null, DraftChangeRevertResult.DependencyConflict))
        val failure = assertIs<DsFailure.Conflict>(
            assertIs<DsResult.Failure>(useCase(whole).execute(owner(), designSystemId, targets(first to 1), "k")).error,
        )
        assertTrue(failure.details.isEmpty())
    }

    @Test
    fun `a missing entry is not found`() = runBlocking {
        val journal = FakeJournal(DraftChangeBatchRevertResult.Failed(1, DraftChangeRevertResult.NotFound))
        val result = useCase(journal).execute(owner(), designSystemId, targets(first to 1, second to 1), "k")

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(result).error)
    }

    @Test
    fun `journal limit maps to unprocessable`() = runBlocking {
        val journal = FakeJournal(DraftChangeBatchRevertResult.Failed(null, DraftChangeRevertResult.LimitExceeded))
        val result = useCase(journal).execute(owner(), designSystemId, targets(first to 1), "k")

        assertEquals(
            "JOURNAL_LIMIT_EXCEEDED",
            assertIs<DsFailure.Unprocessable>(assertIs<DsResult.Failure>(result).error).code,
        )
    }

    @Test
    fun `one idempotency key covers the batch and its payload`() = runBlocking {
        val journal = FakeJournal()
        val requests = MemoryIdempotentRequests()
        val useCase = useCase(journal, requests)
        assertIs<DsResult.Success<Unit>>(
            useCase.execute(owner(), designSystemId, targets(first to 1, second to 1), "k"),
        )

        val replay = assertFailsWith<IdempotentReplayException> {
            useCase.execute(owner(), designSystemId, targets(first to 1, second to 1), "k")
        }
        assertEquals("""{"ok":true}""", replay.response.body)
        val reordered = useCase.execute(owner(), designSystemId, targets(second to 1, first to 1), "k")
        assertEquals(
            "IDEMPOTENCY_KEY_REUSED",
            assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(reordered).error).code,
        )
        assertEquals(listOf(listOf(first, second)), journal.batches)
    }

    @Test
    fun `invalid batches are rejected before the transaction`() = runBlocking {
        val journal = FakeJournal()
        val useCase = useCase(journal)
        suspend fun code(changes: List<DraftChangeRevertTarget>, context: DsRequestContext = owner()) =
            when (
                val error = assertIs<DsResult.Failure>(
                    useCase.execute(context, designSystemId, changes, "k"),
                ).error
            ) {
                is DsFailure.InvalidRequest -> error.code
                else -> error.toString()
            }

        assertEquals("REVERT_BATCH_EMPTY", code(emptyList()))
        assertEquals(
            "REVERT_BATCH_TOO_LARGE",
            code(List(MAX_REVERT_BATCH_SIZE + 1) { DraftChangeRevertTarget(UUID.randomUUID(), 1) }),
        )
        assertEquals("REVERT_BATCH_DUPLICATE_CHANGE", code(targets(first to 1, first to 1)))
        assertEquals("Forbidden", code(targets(first to 1), context("viewer")))
        assertTrue(journal.commits.isEmpty())
    }

    private fun useCase(
        journal: FakeJournal,
        requests: IdempotentRequestRepository = MemoryIdempotentRequests(),
    ) = RevertDraftChangesUseCase(
        DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())),
        journal,
        journal,
        requests,
    )

    private fun owner() = context("owner")

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    ).withIdempotentResponse { _: Unit -> """{"ok":true}""" }

    private fun targets(vararg pairs: Pair<UUID, Int>) =
        pairs.map { (id, revision) -> DraftChangeRevertTarget(id, revision.toLong()) }
}

/** Журнал с заданным итогом пакета и транзакцией, которая запоминает, зафиксирована ли она. */
private class FakeJournal(
    private val outcome: DraftChangeBatchRevertResult = DraftChangeBatchRevertResult.Reverted,
) : DraftChangeRepository, TransactionRunner {
    val batches = mutableListOf<List<UUID>>()
    val commits = mutableListOf<Boolean>()

    override suspend fun <T> rollback(
        context: DsRequestContext,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = required(context, block)

    override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> =
        block().also { commits += it is DsResult.Success }

    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T> = block()

    override suspend fun revertAddressed(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        draftId: UUID,
        targets: List<com.dsbuilder.ds.designsystems.application.DraftAddressTarget>,
    ): DsResult<Unit> {
        batches += targets.map { it.entityId }
        return when (outcome) {
            DraftChangeBatchRevertResult.Reverted -> DsResult.Success(Unit)
            is DraftChangeBatchRevertResult.Failed -> DsResult.Failure(DsFailure.Conflict("fixture_conflict"))
        }
    }

    override suspend fun tokenTargets(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        draftId: UUID,
        tenantId: UUID,
        tokenIds: Set<UUID>,
        cursor: String?,
    ): DsResult<com.dsbuilder.ds.designsystems.application.DraftTokenTargetPage> = DsResult.Success(
        com.dsbuilder.ds.designsystems.application.DraftTokenTargetPage(draftId, "fixture", emptyList(), null),
    )

    override suspend fun summary(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): Int = 0

    override suspend fun changedTokenIds(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        tenantId: UUID,
    ): Set<UUID> = emptySet()

    override suspend fun revertAll(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changes: List<DraftChangeRevertTarget>,
    ): DraftChangeBatchRevertResult {
        batches += changes.map(DraftChangeRevertTarget::changeId)
        return outcome
    }

    override suspend fun revert(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
        expectedRevision: Long,
        paths: Set<String>,
    ): DraftChangeRevertResult = error("single revert")

    override suspend fun list(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): List<DraftChange> = error("journal read")

    override suspend fun hasChanges(projectId: ProjectId, designSystemId: DesignSystemId): Boolean =
        error("journal read")
}

/** Хранилище повторяемых запросов в памяти. */
private class MemoryIdempotentRequests : IdempotentRequestRepository {
    private val saved = mutableMapOf<Pair<String, String>, Pair<String, IdempotentResponse>>()

    override suspend fun lookup(
        projectId: ProjectId,
        key: String,
        operation: String,
        requestHash: String,
    ): IdempotentRequestLookup {
        val previous = saved[key to operation] ?: return IdempotentRequestLookup.New
        return if (previous.first == requestHash) {
            IdempotentRequestLookup.Replayed(previous.second)
        } else {
            IdempotentRequestLookup.PayloadMismatch
        }
    }

    override suspend fun save(
        projectId: ProjectId,
        key: String,
        actorId: String,
        operation: String,
        requestHash: String,
        response: IdempotentResponse,
    ) {
        saved[key to operation] = requestHash to response
    }
}
