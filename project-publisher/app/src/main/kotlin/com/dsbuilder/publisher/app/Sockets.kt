package com.dsbuilder.publisher.app

import io.ktor.server.application.*
import io.ktor.server.websocket.*
import kotlin.time.Duration.Companion.seconds

internal fun Application.configureSockets() {
    install(WebSockets) {
        pingPeriod = 30.seconds
        timeout = 90.seconds
        maxFrameSize = Long.MAX_VALUE
        masking = false
    }
}
