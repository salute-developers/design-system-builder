package com.dsbuilder.ds.tokens.domain

/** Global palette partition. */
enum class PaletteType(/** Wirevalue carried by this contract. */ val wireValue: String) {
    GENERAL("general"),
    ADDITIONAL("additional"),
    ;

    companion object {
        /** Performs the fromWire operation. */
        fun fromWire(value: String?): PaletteType? = entries.firstOrNull { it.wireValue == value }
    }
}
