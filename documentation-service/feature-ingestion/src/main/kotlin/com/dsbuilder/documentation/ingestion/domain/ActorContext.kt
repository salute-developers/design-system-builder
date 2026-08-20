package com.dsbuilder.documentation.ingestion.domain

/** Тип участника, подтвержденный gateway. */
enum class ActorType { USER, PROJECT_KEY }

/** Доверенный контекст участника и проекта. */
data class ActorContext(
    /** Тип участника. */
    val type: ActorType,
    /** Идентификатор участника. */
    val actorId: String,
    /** Идентификатор проекта. */
    val projectId: String,
    /** Проектная роль пользователя. */
    val projectRole: String? = null,
    /** Разрешения project key. */
    val projectScopes: Set<String> = emptySet(),
    /** Признак системного администратора. */
    val systemAdmin: Boolean = false,
)
