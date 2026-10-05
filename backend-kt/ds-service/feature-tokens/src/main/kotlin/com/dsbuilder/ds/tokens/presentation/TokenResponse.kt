package com.dsbuilder.ds.tokens.presentation

import com.dsbuilder.ds.tokens.domain.Token
import kotlinx.serialization.Serializable

/** Legacy-compatible token response. */
@Serializable
data class TokenResponse(
    /** Id carried by this contract. */
    val id: String,
    /** Designsystemid carried by this contract. */
    val designSystemId: String?,
    /** Name carried by this contract. */
    val name: String,
    /** Type carried by this contract. */
    val type: String?,
    /** Displayname carried by this contract. */
    val displayName: String?,
    /** Description carried by this contract. */
    val description: String?,
    /** Enabled carried by this contract. */
    val enabled: Boolean?,
    /** Createdat carried by this contract. */
    val createdAt: String,
    /** Updatedat carried by this contract. */
    val updatedAt: String,
) {
    companion object {
        /** Performs the from operation. */
        fun from(value: Token) = TokenResponse(
            value.id.toString(),
            value.designSystemId?.toString(),
            value.name,
            value.type?.wireValue,
            value.displayName,
            value.description,
            value.enabled,
            value.createdAt.toString(),
            value.updatedAt.toString(),
        )
    }
}
