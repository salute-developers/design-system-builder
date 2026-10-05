package com.dsbuilder.ds.tokens.domain

/** Token kinds accepted by the legacy HTTP contract. */
enum class TokenType(/** Wirevalue carried by this contract. */ val wireValue: String) {
    COLOR("color"),
    GRADIENT("gradient"),
    TYPOGRAPHY("typography"),
    FONT_FAMILY("fontFamily"),
    SPACING("spacing"),
    SHAPE("shape"),
    SHADOW("shadow"),
    ;

    companion object {
        /** Performs the fromWire operation. */
        fun fromWire(value: String?): TokenType? = entries.firstOrNull { it.wireValue == value }
    }
}
