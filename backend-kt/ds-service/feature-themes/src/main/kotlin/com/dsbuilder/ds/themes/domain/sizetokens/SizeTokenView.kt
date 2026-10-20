package com.dsbuilder.ds.themes.domain.sizetokens

import java.util.UUID

/** Токен размеров в формате чтения раздела. */
sealed interface SizeTokenView {
    /** Идентификатор токена. */
    val tokenId: UUID

    /** Полное имя. */
    val name: String

    /** Раздел. */
    val kind: SizeTokenKind

    /** Компоненты, которые используют токен. */
    val components: List<ComponentUsage>
}
