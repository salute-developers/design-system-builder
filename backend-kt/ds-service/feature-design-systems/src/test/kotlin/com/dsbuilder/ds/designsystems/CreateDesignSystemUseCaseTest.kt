package com.dsbuilder.ds.designsystems

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.BaselineSeedScope
import com.dsbuilder.ds.core.application.DesignSystemComponentInitializer
import com.dsbuilder.ds.core.application.DesignSystemTokenInitializer
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.CreateDesignSystem
import com.dsbuilder.ds.designsystems.application.CreateDesignSystemUseCase
import com.dsbuilder.ds.designsystems.application.DesignSystemRepository
import com.dsbuilder.ds.designsystems.application.UpdateDesignSystem
import com.dsbuilder.ds.designsystems.application.VersionBoundaryRepository
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemDraftCursor
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import com.dsbuilder.ds.designsystems.domain.VersionBoundary
import kotlinx.coroutines.runBlocking
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs

/** Проверяет порядок создания с окном наполнения и раннюю проверку имени. */
class CreateDesignSystemUseCaseTest {
    @Test
    fun `templates are seeded inside the window that is verified before the draft`() = runBlocking {
        val fixture = Fixture(nameTaken = false)

        val result = fixture.useCase().execute(fixture.context, COMMAND)

        val created = assertIs<DsResult.Success<DesignSystem>>(result).value
        val id = created.id.value
        assertEquals(
            listOf(
                "nameTaken:Core",
                "createOwned",
                "baseline",
                "begin:$id",
                "tokens:$id",
                "components:$id",
                "verify:$id",
                "draft",
            ),
            fixture.calls,
        )
    }

    @Test
    fun `taken name fails fast without seeding`() = runBlocking {
        val fixture = Fixture(nameTaken = true)

        val result = fixture.useCase().execute(fixture.context, COMMAND)

        val failure = assertIs<DsResult.Failure>(result).error
        assertEquals(DsFailure.Conflict("constraint_conflict"), failure)
        assertEquals(listOf("nameTaken:Core"), fixture.calls)
    }

    @Test
    fun `replayed idempotency key does not check the name again`() {
        val fixture = Fixture(nameTaken = true, replay = IdempotentResponse(201, "{\"id\":\"saved\"}"))

        assertFailsWith<IdempotentReplayException> {
            runBlocking { fixture.useCase().execute(fixture.context, COMMAND, idempotencyKey = "key-1") }
        }

        assertEquals(emptyList(), fixture.calls)
    }

    private class Fixture(nameTaken: Boolean, replay: IdempotentResponse? = null) {
        val calls = mutableListOf<String>()
        val context = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "owner"),
            "correlation-1",
        )
        private val repository = RecordingRepository(calls, nameTaken)
        private val boundaries = RecordingBoundaries(calls)
        private val requests = object : IdempotentRequestRepository {
            override suspend fun lookup(
                projectId: ProjectId,
                key: String,
                operation: String,
                requestHash: String,
            ): IdempotentRequestLookup = replay?.let(IdempotentRequestLookup::Replayed) ?: IdempotentRequestLookup.New

            override suspend fun save(
                projectId: ProjectId,
                key: String,
                actorId: String,
                operation: String,
                requestHash: String,
                response: IdempotentResponse,
            ) = Unit
        }

        fun useCase() = CreateDesignSystemUseCase(
            DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())),
            DirectTransactions(),
            repository,
            boundaries,
            object : DesignSystemTokenInitializer {
                override suspend fun initialize(designSystemId: UUID) {
                    calls += "tokens:$designSystemId"
                }
            },
            object : DesignSystemComponentInitializer {
                override suspend fun initialize(designSystemId: UUID) {
                    calls += "components:$designSystemId"
                }
            },
            object : BaselineSeedScope {
                override suspend fun begin(designSystemId: UUID) {
                    calls += "begin:$designSystemId"
                }

                override suspend fun verify(designSystemId: UUID) {
                    calls += "verify:$designSystemId"
                }
            },
            IdempotentCreateExecutor(requests),
        )
    }

    private companion object {
        val COMMAND = CreateDesignSystem("Core", "Project", null)
    }
}

private class DirectTransactions : TransactionRunner {
    override suspend fun <T> rollback(
        context: DsRequestContext,
        block: suspend () -> DsResult<T>,
    ): DsResult<T> = required(context, block)

    override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
    override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
}

private class RecordingRepository(
    private val calls: MutableList<String>,
    private val nameTaken: Boolean,
) : DesignSystemRepository {
    override suspend fun isNameTaken(name: String): Boolean {
        calls += "nameTaken:$name"
        return nameTaken
    }

    override suspend fun createOwned(projectId: ProjectId, command: CreateDesignSystem): DesignSystem {
        calls += "createOwned"
        return DesignSystem(
            id = DesignSystemId(UUID.randomUUID()),
            name = command.name,
            projectName = command.projectName,
            projectId = projectId,
            description = command.description,
            createdAt = Instant.EPOCH,
            updatedAt = Instant.EPOCH,
        )
    }

    override suspend fun listAccessible(projectId: ProjectId): List<DesignSystem> = error("read")

    override suspend fun findAccessible(projectId: ProjectId, id: DesignSystemId): DesignSystem? = error("read")

    override suspend fun findDraftCursorAccessible(
        projectId: ProjectId,
        id: DesignSystemId,
    ): DesignSystemDraftCursor? = error("read")

    override suspend fun updateOwned(
        projectId: ProjectId,
        id: DesignSystemId,
        command: UpdateDesignSystem,
    ): DesignSystem? = error("mutation")

    override suspend fun deleteOwned(projectId: ProjectId, id: DesignSystemId): Boolean = error("mutation")
}

private class RecordingBoundaries(private val calls: MutableList<String>) : VersionBoundaryRepository {
    override suspend fun initializeBaseline(designSystem: DesignSystem): VersionBoundary {
        calls += "baseline"
        return boundary(designSystem.id, 0, DesignSystemVersionStatus.BASELINE)
    }

    override suspend fun initializeDraft(designSystemId: DesignSystemId): VersionBoundary {
        calls += "draft"
        return boundary(designSystemId, 1, DesignSystemVersionStatus.DRAFT)
    }

    override suspend fun activeDraft(designSystemId: DesignSystemId): VersionBoundary? = error("read")

    override suspend fun published(
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId,
    ): VersionBoundary? = error("read")

    override suspend fun listPublished(designSystemId: DesignSystemId): List<VersionBoundary> = error("read")

    override suspend fun previousPublished(
        designSystemId: DesignSystemId,
        beforeSequenceNumber: Long,
    ): VersionBoundary? = error("read")

    private fun boundary(owner: DesignSystemId, sequence: Long, status: DesignSystemVersionStatus) = VersionBoundary(
        id = DesignSystemVersionId(UUID.randomUUID()),
        designSystemId = owner,
        sequenceNumber = sequence,
        revision = 0,
        status = status,
    )
}
