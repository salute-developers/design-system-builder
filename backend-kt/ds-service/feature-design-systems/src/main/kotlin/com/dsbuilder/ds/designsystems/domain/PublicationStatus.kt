package com.dsbuilder.ds.designsystems.domain

/** Database-backed publication state. */
enum class PublicationStatus(/** Wire value carried by this contract. */ val wireValue: String) {
    PUBLISHING("publishing"),
    PUBLISHED("published"),
    FAILED("failed"),
    ;

    companion object {
        /** Performs the fromwire operation. */
        fun fromWire(value: String): PublicationStatus? = entries.firstOrNull { it.wireValue == value }
    }
}
