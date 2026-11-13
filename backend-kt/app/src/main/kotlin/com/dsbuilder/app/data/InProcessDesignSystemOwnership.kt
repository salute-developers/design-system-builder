package com.dsbuilder.app.data

import com.dsbuilder.documentation.ingestion.application.DesignSystemOwnershipVerifier
import com.dsbuilder.documentation.ingestion.application.OwnershipResult
import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.designsystems.application.DesignSystemAccess
import kotlinx.coroutines.CancellationException
import java.util.UUID

/** Проверяет доступ через прикладной контракт DS с прежними правами и транзакцией. */
class InProcessDesignSystemOwnership(private val access: DesignSystemAccess) : DesignSystemOwnershipVerifier {
    override suspend fun verify(id: String, actor: ActorContext): OwnershipResult = try {
        when (val result = access.check(DsRequestContext(actor, UUID.randomUUID().toString()), id)) {
            is DsResult.Success -> OwnershipResult.OWNED
            is DsResult.Failure -> when (result.error) {
                DsFailure.NotFound -> OwnershipResult.NOT_FOUND
                DsFailure.Forbidden -> OwnershipResult.FORBIDDEN
                else -> OwnershipResult.UNAVAILABLE
            }
        }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        OwnershipResult.UNAVAILABLE
    }
}
