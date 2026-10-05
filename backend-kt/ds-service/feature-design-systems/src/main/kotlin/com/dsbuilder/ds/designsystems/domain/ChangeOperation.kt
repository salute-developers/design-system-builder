package com.dsbuilder.ds.designsystems.domain

/** Database-backed change operation. */
enum class ChangeOperation(/** Wire value carried by this contract. */ val wireValue: String) {
    CREATED("created"),
    UPDATED("updated"),
    DELETED("deleted"),
    MOVED("moved"),
    ;

    companion object {
        /** Performs the fromwire operation. */
        fun fromWire(value: String): ChangeOperation? = entries.firstOrNull { it.wireValue == value }
    }
}
