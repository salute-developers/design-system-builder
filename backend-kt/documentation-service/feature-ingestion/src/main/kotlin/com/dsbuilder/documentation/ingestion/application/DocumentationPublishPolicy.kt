package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.documentation.ingestion.domain.ActorContext

/** Политика разрешения публикации документации. */
class DocumentationPublishPolicy(
    private val evaluator: PolicyEvaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()),
) {

    /** Возвращает true только для валидного trusted context с publish-доступом. */
    fun allows(actor: ActorContext): Boolean = evaluator.isAllowed(actor, DOCUMENTATION_WRITE)

    private companion object {
        const val DOCUMENTATION_WRITE = "documentation:write"
    }
}
