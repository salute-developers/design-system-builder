package com.dsbuilder.ds.tokens.application

import com.dsbuilder.ds.tokens.domain.TokenType

/** Patch input preserving absent and explicit-null fields. */
data class UpdateToken(
    /** Name carried by this contract. */
    val name: String?,
    /** Namepresent carried by this contract. */
    val namePresent: Boolean,
    /** Type carried by this contract. */
    val type: TokenType?,
    /** Typepresent carried by this contract. */
    val typePresent: Boolean,
    /** Displayname carried by this contract. */
    val displayName: String?,
    /** Displaynamepresent carried by this contract. */
    val displayNamePresent: Boolean,
    /** Description carried by this contract. */
    val description: String?,
    /** Descriptionpresent carried by this contract. */
    val descriptionPresent: Boolean,
    /** Enabled carried by this contract. */
    val enabled: Boolean?,
    /** Enabledpresent carried by this contract. */
    val enabledPresent: Boolean,
)
