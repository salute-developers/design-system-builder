package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.AcceptanceDiagnostic
import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.documentation.ingestion.domain.DocumentationBundle
import com.dsbuilder.documentation.ingestion.domain.IngestionJob
import com.dsbuilder.documentation.ingestion.domain.IngestionStatus
import kotlinx.coroutines.CancellationException

/** Оркестрирует проверку, immutable storage и атомарное создание metadata/job. */
class AcceptDocumentationBundleUseCase(
    private val inspector: BundleArchiveInspector,
    private val ownershipVerifier: DesignSystemOwnershipVerifier,
    private val storage: RawBundleStorage,
    private val bundleRepository: DocumentationBundleRepository,
    private val jobRepository: IngestionJobRepository,
    private val transactions: TransactionManager,
    private val clock: Clock,
    private val ids: IdGenerator,
) {
    /** Принимает один предварительно ограниченный temporary bundle. */
    suspend fun execute(source: BundleSource, actor: ActorContext): AcceptanceResult =
        authorize(actor) ?: inspectAndAccept(source, actor)

    private suspend fun inspectAndAccept(source: BundleSource, actor: ActorContext): AcceptanceResult {
        val inspected = inspector.inspect(source)
        val ownershipFailure = verifyOwnership(inspected.manifest.designSystemId, actor)
        return ownershipFailure ?: storeAndPersist(source, actor, inspected)
    }

    private suspend fun storeAndPersist(
        source: BundleSource,
        actor: ActorContext,
        inspected: InspectedBundle,
    ): AcceptanceResult {
        val identifiers = AcceptanceIdentifiers(
            bundleId = ids.next(),
            jobId = ids.next(),
        )
        val stored = storeRawBundle(source, actor.projectId, identifiers.bundleId)
            ?: return rejected(AcceptanceFailure.UNAVAILABLE, STORAGE_UNAVAILABLE)
        return persistAcceptance(source, actor, inspected, stored, identifiers)
    }

    private fun authorize(actor: ActorContext): AcceptanceResult.Rejected? =
        if (DocumentationPublishPolicy.allows(actor)) {
            null
        } else {
            rejected(AcceptanceFailure.FORBIDDEN, PUBLISH_FORBIDDEN)
        }

    private suspend fun verifyOwnership(
        designSystemId: String,
        actor: ActorContext,
    ): AcceptanceResult.Rejected? = when (ownershipVerifier.verify(designSystemId, actor)) {
        OwnershipResult.OWNED -> null
        OwnershipResult.NOT_FOUND -> rejected(AcceptanceFailure.NOT_FOUND, DESIGN_SYSTEM_NOT_FOUND)
        OwnershipResult.FORBIDDEN -> rejected(AcceptanceFailure.FORBIDDEN, OWNERSHIP_FORBIDDEN)
        OwnershipResult.UNAVAILABLE -> rejected(AcceptanceFailure.UNAVAILABLE, DB_SERVICE_UNAVAILABLE)
    }

    private suspend fun storeRawBundle(
        source: BundleSource,
        projectId: String,
        bundleId: String,
    ): StoredBundle? = try {
        storage.put(source, projectId, bundleId)
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        null
    }

    private suspend fun persistAcceptance(
        source: BundleSource,
        actor: ActorContext,
        inspected: InspectedBundle,
        stored: StoredBundle,
        identifiers: AcceptanceIdentifiers,
    ): AcceptanceResult {
        val acceptedAt = clock.now()
        return try {
            transactions.transaction {
                bundleRepository.create(source.toBundle(actor, inspected, stored, identifiers.bundleId, acceptedAt))
                jobRepository.create(
                    IngestionJob(
                        id = identifiers.jobId,
                        bundleId = identifiers.bundleId,
                        status = IngestionStatus.ACCEPTED,
                        createdAt = acceptedAt,
                    ),
                )
            }
            identifiers.accepted()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            reconcilePersistenceFailure(stored, identifiers)
        }
    }

    private suspend fun reconcilePersistenceFailure(
        stored: StoredBundle,
        identifiers: AcceptanceIdentifiers,
    ): AcceptanceResult = when (readPersistenceState(identifiers.bundleId)) {
        PersistenceState.COMMITTED -> identifiers.accepted()
        PersistenceState.ROLLED_BACK -> {
            deleteOrphan(stored)
            rejected(AcceptanceFailure.UNAVAILABLE, PERSISTENCE_UNAVAILABLE)
        }
        PersistenceState.UNKNOWN -> rejected(AcceptanceFailure.UNAVAILABLE, PERSISTENCE_STATE_UNKNOWN)
    }

    private suspend fun readPersistenceState(bundleId: String): PersistenceState = try {
        if (bundleRepository.exists(bundleId)) PersistenceState.COMMITTED else PersistenceState.ROLLED_BACK
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        PersistenceState.UNKNOWN
    }

    private suspend fun deleteOrphan(stored: StoredBundle) {
        try {
            storage.delete(stored)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // Object остается orphan candidate для reconciliation.
        }
    }

    private fun BundleSource.toBundle(
        actor: ActorContext,
        inspected: InspectedBundle,
        stored: StoredBundle,
        bundleId: String,
        acceptedAt: java.time.Instant,
    ) = DocumentationBundle(
        id = bundleId,
        projectId = actor.projectId,
        manifest = inspected.manifest,
        bucket = stored.bucket,
        storageKey = stored.key,
        sha256 = sha256,
        compressedSize = compressedSize,
        uncompressedSize = inspected.uncompressedSize,
        originalFilename = originalFilename,
        actor = actor,
        uploadedAt = acceptedAt,
    )

    private fun rejected(
        failure: AcceptanceFailure,
        diagnostic: AcceptanceDiagnostic,
    ) = AcceptanceResult.Rejected(failure, listOf(diagnostic))

    private data class AcceptanceIdentifiers(val bundleId: String, val jobId: String) {
        fun accepted() = AcceptanceResult.Accepted(bundleId, jobId)
    }

    private enum class PersistenceState { COMMITTED, ROLLED_BACK, UNKNOWN }

    private companion object {

        val PUBLISH_FORBIDDEN = AcceptanceDiagnostic(
            "PUBLISH_FORBIDDEN",
            "Недостаточно прав для публикации.",
        )
        val DESIGN_SYSTEM_NOT_FOUND = AcceptanceDiagnostic(
            "DESIGN_SYSTEM_NOT_FOUND",
            "Design system не найдена в проекте.",
        )
        val OWNERSHIP_FORBIDDEN = AcceptanceDiagnostic(
            "OWNERSHIP_FORBIDDEN",
            "Доступ к design system запрещен.",
        )
        val DB_SERVICE_UNAVAILABLE = AcceptanceDiagnostic(
            "DB_SERVICE_UNAVAILABLE",
            "Сервис данных временно недоступен.",
        )
        val STORAGE_UNAVAILABLE = AcceptanceDiagnostic(
            "STORAGE_UNAVAILABLE",
            "Хранилище временно недоступно.",
        )
        val PERSISTENCE_UNAVAILABLE = AcceptanceDiagnostic(
            "PERSISTENCE_UNAVAILABLE",
            "Сервис временно недоступен.",
        )
        val PERSISTENCE_STATE_UNKNOWN = AcceptanceDiagnostic(
            "PERSISTENCE_STATE_UNKNOWN",
            "Состояние сохранения временно неизвестно.",
        )
    }
}
