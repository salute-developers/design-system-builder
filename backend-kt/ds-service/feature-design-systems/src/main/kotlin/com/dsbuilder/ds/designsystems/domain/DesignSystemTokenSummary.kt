package com.dsbuilder.ds.designsystems.domain

import java.time.Instant
import java.util.UUID

/** Token fields exposed by the design-system aggregate endpoint. */
data class DesignSystemTokenSummary(
    /** Id carried by this contract. */
    val id: UUID,
    /** Design system id carried by this contract. */
    val designSystemId: UUID?,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: String?,
    /** Display name carried by this contract. */
    val displayName: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Enabled carried by this contract. */
    val enabled: Boolean?,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
    /** Группа или подгруппа токенов; `null` — токен без группы. */
    val groupId: UUID?,
    /** Позиция в группе или подгруппе; у всех определений семейства цветового токена одна. */
    val position: Int,
    /** Последняя опубликованная версия, в которую попало определение, или `null`. */
    val publishedIn: String?,
)
