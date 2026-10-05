package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import java.util.UUID

/** Optional filters of the nested token-values lookup. */
data class TokenValueFilter(
    /** Tenantid carried by this contract. */
    val tenantId: UUID?,
    /** Platform carried by this contract. */
    val platform: TokenPlatform?,
    /** Mode carried by this contract. */
    val mode: TokenMode?,
)
