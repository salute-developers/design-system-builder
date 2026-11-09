package com.dsbuilder.frontend.core.network

import io.ktor.http.encodeURLParameter

private val editorId = Regex("^[A-Za-z0-9_-]+$")

/** Кодирует идентификатор сегмента, запрещая разделители и переходы между маршрутами. */
public fun String.encodeEditorId(): String {
    require(editorId.matches(this)) { "Invalid editor resource identifier." }
    return encodeURLParameter()
}
