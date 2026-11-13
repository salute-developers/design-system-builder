package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.MAX_IDEMPOTENCY_KEY_LENGTH
import com.dsbuilder.ds.core.application.PublicationTransactionRunner
import com.dsbuilder.ds.core.application.RequestHash
import com.dsbuilder.ds.core.application.conflict
import com.dsbuilder.ds.core.application.scopedOperation
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Атомарно публикует активный черновик дизайн-системы. */
class CreateDesignSystemVersionUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: PublicationTransactionRunner,
    private val repository: DesignSystemVersionRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Публикует команду после проверки разрешения и повторяемости. */
    suspend fun execute(
        context: DsRequestContext,
        command: CreateDesignSystemVersion,
        idempotencyKey: String,
    ): DsResult<DesignSystemVersion> {
        if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
            return DsResult.Failure(DsFailure.InvalidRequest("idempotency_key_too_long"))
        }
        return when (val allowed = policy.require(context, "design-systems:write")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> publish(context, command, idempotencyKey)
        }
    }

    private suspend fun publish(
        context: DsRequestContext,
        command: CreateDesignSystemVersion,
        idempotencyKey: String,
    ): DsResult<DesignSystemVersion> {
        val requestHash = RequestHash.canonical(command)
        val operation = context.scopedOperation(PUBLISH_OPERATION)
        val checkReplay: suspend () -> DsResult<Unit> = {
            when (val previous = repeatedRequests.lookup(context.projectId, idempotencyKey, operation, requestHash)) {
                IdempotentRequestLookup.PayloadMismatch ->
                    DsResult.Failure(DsFailure.Conflict("IDEMPOTENCY_KEY_REUSED"))
                is IdempotentRequestLookup.Replayed -> throw IdempotentReplayException(previous.response)
                IdempotentRequestLookup.New -> DsResult.Success(Unit)
            }
        }
        return transactions.required(context, command.designSystemId.value, beforeLock = checkReplay) {
            // Между предварительной проверкой и барьером ключ мог занять другой запрос.
            when (val checked = checkReplay()) {
                is DsResult.Failure -> checked
                is DsResult.Success -> publishNew(context, command, idempotencyKey, operation, requestHash)
            }
        }
    }

    private suspend fun publishNew(
        context: DsRequestContext,
        command: CreateDesignSystemVersion,
        idempotencyKey: String,
        operation: String,
        requestHash: String,
    ): DsResult<DesignSystemVersion> =
        when (val result = repository.publish(context.projectId, command)) {
            is PublishDesignSystemResult.Published -> {
                repeatedRequests.save(
                    context.projectId,
                    idempotencyKey,
                    context.principal.actorId,
                    operation,
                    requestHash,
                    IdempotentResponse(
                        201,
                        context.idempotentResponseEncoder?.invoke(result.version)
                            ?: result.version.toStoredJson(),
                    ),
                )
                DsResult.Success(result.version)
            }
            is PublishDesignSystemResult.DraftStale -> DsResult.Failure(
                DsFailure.Conflict(
                    code = "DRAFT_STALE",
                    draftId = result.draftId.value.toString(),
                    draftRevision = result.draftRevision,
                ),
            )
            is PublishDesignSystemResult.CoreConflict -> DsResult.Failure(result.report.conflict(context.projectId))
            PublishDesignSystemResult.EmptyDraft ->
                DsResult.Failure(DsFailure.Conflict("DRAFT_EMPTY"))
            PublishDesignSystemResult.VersionAlreadyExists ->
                DsResult.Failure(DsFailure.Conflict("VERSION_ALREADY_EXISTS"))
            PublishDesignSystemResult.NotFound -> DsResult.Failure(DsFailure.NotFound)
        }

    private fun DesignSystemVersion.toStoredJson(): String = buildJsonObject {
        put("id", id.value.toString())
        put("designSystemId", designSystemId.value.toString())
        put("sequenceNumber", sequenceNumber)
        put("revision", revision)
        put("version", version)
        put("changelog", changelog)
        put("publishedAt", publishedAt.toString())
    }.toString()

    private companion object {
        const val PUBLISH_OPERATION = "publish-design-system"
    }
}
