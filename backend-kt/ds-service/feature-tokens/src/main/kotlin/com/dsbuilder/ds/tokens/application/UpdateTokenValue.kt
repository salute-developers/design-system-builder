package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Patch input for a token value. */
data class UpdateTokenValue(
    /** Paletteid carried by this contract. */
    val paletteId: UUID?,
    /** Paletteidpresent carried by this contract. */
    val paletteIdPresent: Boolean,
    /** Platform carried by this contract. */
    val platform: TokenPlatform?,
    /** Platformpresent carried by this contract. */
    val platformPresent: Boolean,
    /** Mode carried by this contract. */
    val mode: TokenMode?,
    /** Modepresent carried by this contract. */
    val modePresent: Boolean,
    /** Value carried by this contract. */
    val value: JsonElement?,
    /** Valuepresent carried by this contract. */
    val valuePresent: Boolean,
)
