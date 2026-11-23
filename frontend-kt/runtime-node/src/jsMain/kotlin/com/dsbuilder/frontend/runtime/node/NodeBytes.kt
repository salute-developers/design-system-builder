package com.dsbuilder.frontend.runtime.node

/** Представления бинарных данных с учётом смещения среза, без побайтового копирования. */
internal fun nodeBuffer(bytes: ByteArray): dynamic =
    js("Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length)")

internal fun nodeBytes(buffer: dynamic): ByteArray =
    js("new Int8Array(buffer.buffer, buffer.byteOffset, buffer.length)").unsafeCast<ByteArray>()
