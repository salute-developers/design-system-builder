package com.dsbuilder.ds.tokens.domain

/** Token-value target platform. */
enum class TokenPlatform(/** Wirevalue carried by this contract. */ val wireValue: String) {
    WEB("web"),
    ANDROID("android"),
    IOS("ios"),
    ;

    companion object {
        /** Performs the fromWire operation. */
        fun fromWire(value: String?): TokenPlatform? = entries.firstOrNull { it.wireValue == value }
    }
}
