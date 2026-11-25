package com.dsbuilder.frontend.plugin.androidstudio.preview

import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PreviewSessionTest {
    private fun ready() = jsonObject(
        "type" to string("sdds.preview.ready"),
        "protocolVersion" to JsonPrimitive(1),
    )
    private fun result(id: String) = jsonObject(
        "type" to string("sdds.preview.result"),
        "result" to jsonObject("type" to string("success"), "requestId" to string(id)),
    )

    @Test
    fun ignoresUnrelatedRepliesAndWaitsForCorrelatedSuccess() = runBlocking {
        val sent = mutableListOf<JsonObject>()
        val session = PreviewSession(send = { sent.add(it) })
        session.receive(ready())
        val request = async(start = CoroutineStart.UNDISPATCHED) { session.render(JsonObject(emptyMap())) }
        session.receive(result("other-request"))
        assertFalse(request.isCompleted)
        session.receive(result(requireNotNull(sent.single().text("requestId"))))
        request.await()
        session.dispose()
    }

    @Test
    fun newerPayloadSupersedesOldPayloadAndDisposeCancelsPendingWork() = runBlocking {
        val session = PreviewSession(send = {})
        session.receive(ready())
        val old = async(start = CoroutineStart.UNDISPATCHED) { session.render(JsonObject(emptyMap())) }
        val current = async(start = CoroutineStart.UNDISPATCHED) { session.render(JsonObject(emptyMap())) }
        yield()
        assertTrue(old.isCancelled)
        assertFalse(current.isCompleted)
        session.dispose()
        yield()
        assertTrue(current.isCancelled)
    }

    @Test
    fun timesOutBeforeReadyAndWhileWaitingForResult() = runBlocking {
        val sent = mutableListOf<JsonObject>()
        val session = PreviewSession(send = { sent.add(it) }, timeoutMillis = 10)
        assertFailsWith<TimeoutCancellationException> { session.render(JsonObject(emptyMap())) }
        assertTrue(sent.isEmpty())
        session.receive(ready())
        assertFailsWith<TimeoutCancellationException> { session.render(JsonObject(emptyMap())) }
        assertTrue(sent.size == 1)
        session.dispose()
    }

    @Test
    fun rejectsWrongProtocolAndResponseDirection() = runBlocking {
        val sent = mutableListOf<JsonObject>()
        val session = PreviewSession(send = { sent.add(it) })
        session.receive(ready())
        val request = async(start = CoroutineStart.UNDISPATCHED) { session.render(JsonObject(emptyMap())) }
        val reply = result(requireNotNull(sent.single().text("requestId")))
        session.receive(JsonObject(reply + ("protocolVersion" to JsonPrimitive(2))))
        session.receive(JsonObject(reply + ("protocolVersion" to string("1"))))
        session.receive(JsonObject(reply + ("type" to string("sdds.preview.description"))))
        assertFalse(request.isCompleted)
        session.receive(reply)
        request.await()
        session.dispose()
    }
}
