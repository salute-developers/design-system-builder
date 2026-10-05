package com.dsbuilder.ds.core.application

import java.time.Instant

/** Injectable source of wall-clock time. */
fun interface Clock {
    /** Returns the current instant. */
    fun now(): Instant
}
