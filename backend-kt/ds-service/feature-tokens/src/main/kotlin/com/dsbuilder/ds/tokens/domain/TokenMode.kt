package com.dsbuilder.ds.tokens.domain

/** Optional light or dark token-value mode. */
enum class TokenMode(/** Wirevalue carried by this contract. */ val wireValue: String) {
    LIGHT("light"),
    DARK("dark"),
    ;

    companion object {
        /** Performs the fromWire operation. */
        fun fromWire(value: String?): TokenMode? = entries.firstOrNull { it.wireValue == value }
    }
}
