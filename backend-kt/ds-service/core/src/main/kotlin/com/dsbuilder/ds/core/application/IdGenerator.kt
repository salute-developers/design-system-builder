package com.dsbuilder.ds.core.application

import java.util.UUID

/** Injectable UUID source. */
fun interface IdGenerator {
    /** Returns a new entity identifier. */
    fun next(): UUID
}
