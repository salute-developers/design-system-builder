package com.dsbuilder.documentation.ingestion.application

import com.dsbuilder.documentation.ingestion.domain.ActorContext

/** Результат проверки принадлежности design system. */
enum class OwnershipResult { OWNED, NOT_FOUND, FORBIDDEN, UNAVAILABLE }

/** Проверяет design system в доверенном project context. */
fun interface DesignSystemOwnershipVerifier {
    /** Проверяет принадлежность design system проекту trusted actor. */
    suspend fun verify(id: String, actor: ActorContext): OwnershipResult
}
