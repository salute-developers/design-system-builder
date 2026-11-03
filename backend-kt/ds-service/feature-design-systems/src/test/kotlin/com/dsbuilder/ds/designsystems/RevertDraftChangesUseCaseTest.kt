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
import com.dsbuilder.ds.designsystems.application.DraftChangeLimitExceededException
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

/** Пакетный откат журнала: атомарность, проверка снимка до пакета, повторяемость и границы запроса. */
class RevertDraftChangesUseCaseTest {
    private val designSystemId = DesignSystemId(UUID.randomUUID())
    private val first = UUID.randomUUID()
    private val second = UUID.randomUUID()
    private val third = UUID.randomUUID()

    @Test
    fun `reverts every entry in the requested order`() = runBlocking {
        val journal = FakeJournal(mapOf(first to 3, second to 1, third to 7))
        val result = useCase(
            journal,
        ).execute(owner(), designSystemId, targets(first to 3, second to 1, third to 7), "k")

        assertIs<DsResult.Success<Unit>>(result)
        assertEquals(listOf(first, second, third), journal.reverted)
        assertTrue(journal.committed.isEmpty())
    }

    @Test
    fun `a stale entry rolls back the whole batch and names its position`() = runBlocking {
        val journal = FakeJournal(mapOf(first to 3, second to 2))
        val result = useCase(journal).execute(owner(), designSystemId, targets(first to 3, second to 1), "k")

        val conflict = assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(result).error)
        assertEquals("DRAFT_CHANGE_STALE", conflict.code)
        assertEquals(2, conflict.editRevision)
        assertEquals(mapOf("changeIndex" to listOf(1)), conflict.details)
        // Снимок проверяется до первого отката: ни одна запись не тронута.
        assertTrue(journal.reverted.isEmpty())
        assertEquals(mapOf(first to 3L, second to 2L), journal.committed)
    }

    @Test
    fun `a failed revert in the middle discards earlier reverts of the batch`() = runBlocking {
        val journal =
            FakeJournal(
                mapOf(first to 1, second to 1),
                failing = mapOf(second to DraftChangeRevertResult.DependencyConflict),
            )
        val result = useCase(journal).execute(owner(), designSystemId, targets(first to 1, second to 1), "k")

        val conflict = assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(result).error)
        assertEquals("REVERT_DEPENDENCY_CONFLICT", conflict.code)
        assertEquals(mapOf("changeIndex" to listOf(1)), conflict.details)
        assertEquals(mapOf(first to 1L, second to 1L), journal.committed)
    }

    @Test
    fun `side effects of earlier reverts in the batch do not make later entries stale`() = runBlocking {
        // Откат значения пересчитывает тип семейства: редакция определения растёт, а соседняя запись исчезает.
        val journal = FakeJournal(
            mapOf(first to 1, second to 4, third to 2),
            sideEffects = mapOf(
                first to { state ->
                    state[second] = 5
                    state.remove(third)
                },
            ),
        )
        val result = useCase(
            journal,
        ).execute(owner(), designSystemId, targets(first to 1, second to 4, third to 2), "k")

        assertIs<DsResult.Success<Unit>>(result)
        assertEquals(listOf(first, second), journal.reverted)
        assertEquals(listOf(1L, 5L), journal.revertRevisions)
        assertTrue(journal.committed.isEmpty())
    }

    @Test
    fun `a missing entry is not found and nothing is reverted`() = runBlocking {
        val journal = FakeJournal(mapOf(first to 1))
        val result = useCase(journal).execute(owner(), designSystemId, targets(first to 1, second to 1), "k")

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(result).error)
        assertTrue(journal.reverted.isEmpty())
    }

    @Test
    fun `journal limit maps to unprocessable`() = runBlocking {
        val journal = FakeJournal(mapOf(first to 1), limitExceeded = true)
        val result = useCase(journal).execute(owner(), designSystemId, targets(first to 1), "k")

        assertEquals(
            "JOURNAL_LIMIT_EXCEEDED",
            assertIs<DsFailure.Unprocessable>(assertIs<DsResult.Failure>(result).error).code,
        )
    }

    @Test
    fun `one idempotency key covers the batch and its payload`() = runBlocking {
        val journal = FakeJournal(mapOf(first to 1, second to 1))
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
        assertEquals(listOf(first, second), journal.reverted)
    }

    @Test
    fun `invalid batches are rejected before the transaction`() = runBlocking {
        val journal = FakeJournal(mapOf(first to 1))
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
        assertEquals(0, journal.transactions)
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

/** Журнал в памяти с транзакцией, которая отбрасывает изменения при отказе. */
private class FakeJournal(
    initial: Map<UUID, Int>,
    private val failing: Map<UUID, DraftChangeRevertResult> = emptyMap(),
    private val sideEffects: Map<UUID, (MutableMap<UUID, Long>) -> Unit> = emptyMap(),
    private val limitExceeded: Boolean = false,
) : DraftChangeRepository, TransactionRunner {
    var committed: Map<UUID, Long> = initial.mapValues { it.value.toLong() }
    private var working: MutableMap<UUID, Long> = committed.toMutableMap()
    val reverted = mutableListOf<UUID>()
    val revertRevisions = mutableListOf<Long>()
    var transactions = 0

    override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> {
        transactions += 1
        working = committed.toMutableMap()
        val log = reverted.size
        val result = block()
        if (result is DsResult.Success) {
            committed = working.toMap()
        } else {
            while (reverted.size > log) reverted.removeAt(reverted.lastIndex)
        }
        return result
    }

    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T> = block()

    override suspend fun currentRevision(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
    ): Long? {
        if (limitExceeded) throw DraftChangeLimitExceededException()
        return working[changeId]
    }

    override suspend fun revert(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
        expectedRevision: Long,
        paths: Set<String>,
    ): DraftChangeRevertResult {
        failing[changeId]?.let { return it }
        val current = working[changeId] ?: return DraftChangeRevertResult.NotFound
        if (current != expectedRevision) return DraftChangeRevertResult.Stale(current)
        working.remove(changeId)
        reverted += changeId
        revertRevisions += expectedRevision
        sideEffects[changeId]?.invoke(working)
        return DraftChangeRevertResult.Reverted
    }

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
