package com.dsbuilder.frontend.runtime.node

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.await
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlin.js.Promise
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class NodePkceTest {
    @Test
    fun callbackWaitsForCompletionAndRejectsReplay() = runTest {
        withContext(Dispatchers.Default) {
            val platform = NodePkcePlatform(
                { success -> if (success) "Сессия сохранена" else "Вход отклонён" },
                mapOf("Content-Type" to "text/html; charset=utf-8", "Cache-Control" to "no-store"),
            )
            val first = platform.generate()
            val second = platform.generate()
            assertTrue(first.state != second.state && first.verifier != second.verifier)
            assertTrue(first.challenge.isNotBlank())
            val listener = platform.listen()
            try {
                val pending = async {
                    fetch("http://127.0.0.1:${listener.port}/callback?state=one&state=two&code=fixture")
                }
                val callback = listener.awaitCallback()
                assertEquals(listOf("one", "two"), callback.parameters["state"])
                assertEquals("/callback", callback.path)
                assertTrue(!pending.isCompleted)
                listener.complete(true)
                val response = pending.await()
                assertEquals(200, response.status as Int)
                assertEquals("Сессия сохранена", (response.text() as Promise<String>).await())
                assertEquals("no-store", response.headers.get("cache-control") as String)
                val replay = fetch("http://127.0.0.1:${listener.port}/callback?code=again")
                assertEquals(409, replay.status as Int)
                assertEquals("Вход отклонён", (replay.text() as Promise<String>).await())
            } finally { listener.close() }
        }
    }

    private suspend fun fetch(url: String): dynamic = (js("globalThis.fetch")(url) as Promise<dynamic>).await()
}
