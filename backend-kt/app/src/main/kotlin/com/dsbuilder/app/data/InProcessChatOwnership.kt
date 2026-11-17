package com.dsbuilder.app.data

import com.dsbuilder.ai.chat.application.DesignSystemOwnership
import com.dsbuilder.ai.chat.application.OwnershipCheck
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.documentation.ingestion.application.DesignSystemOwnershipVerifier
import com.dsbuilder.documentation.ingestion.application.OwnershipResult

/** Проверка принадлежности DS для чата через тот же адаптер внутри процесса, что у документации. */
class InProcessChatOwnership(private val verifier: DesignSystemOwnershipVerifier) : DesignSystemOwnership {
    override suspend fun check(principal: ProjectPrincipal, designSystemId: String): OwnershipCheck =
        when (verifier.verify(designSystemId, principal)) {
            OwnershipResult.OWNED -> OwnershipCheck.OWNED
            OwnershipResult.NOT_FOUND -> OwnershipCheck.NOT_FOUND
            OwnershipResult.FORBIDDEN -> OwnershipCheck.FORBIDDEN
            OwnershipResult.UNAVAILABLE -> OwnershipCheck.UNAVAILABLE
        }
}
