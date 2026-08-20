package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.ActorContext
import com.dsbuilder.documentation.ingestion.domain.ActorType

/** Политика разрешения публикации документации. */
object DocumentationPublishPolicy {
    private val publishingRoles = setOf("owner", "maintainer", "editor")

    /** Возвращает true только для валидного trusted context с publish-доступом. */
    fun allows(actor: ActorContext): Boolean =
        actor.projectId.isNotBlank() && actor.actorId.isNotBlank() && when (actor.type) {
            ActorType.PROJECT_KEY -> true
            ActorType.USER -> actor.projectRole?.lowercase() in publishingRoles
        }
}
