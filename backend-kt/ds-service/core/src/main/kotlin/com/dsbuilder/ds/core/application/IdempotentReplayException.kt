package com.dsbuilder.ds.core.application

/** Short-circuits presentation with the exact response saved by the first request. */
class IdempotentReplayException(
    /** Immutable HTTP result of the original request. */
    val response: IdempotentResponse,
) : RuntimeException(null, null, false, false)
