package com.dsbuilder.frontend.core.network

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MutationConfirmationTest {
    private val confirmed = HttpMutationResult.Response(
        201,
        "{\"id\":\"created\"}",
        mapOf("x-ds-mutation-metadata-truncated" to "true"),
        true,
    )

    @Test
    fun oversizedUtf8ReadCannotReplaceTheConfirmedWrite() = runTest {
        val result = client("я".repeat(10_000)).confirmTruncatedMutation(confirmed, listOf("/resource"))
            as HttpMutationResult.Response
        assertEquals(confirmed.statusCode, result.statusCode)
        assertEquals(confirmed.body, result.body)
        assertEquals(confirmed.headers, result.headers)
        assertTrue(result.confirmationAttempted)
        assertTrue(result.confirmationIncomplete)
        assertTrue(result.confirmedReads.isEmpty())
    }

    @Test
    fun multipleReadsShareOneBudgetAndDoNotReturnBrokenJson() = runTest {
        val body = "\"" + "x".repeat(9_000) + "\""
        val result = client(body).confirmTruncatedMutation(confirmed, listOf("/one", "/two"))
            as HttpMutationResult.Response
        assertEquals(mapOf("/one" to body), result.confirmedReads)
        assertTrue(result.confirmationIncomplete)
    }

    @Test
    fun invalidCreatedIdsNeverEscapeTheSystemOrHideSuccess() {
        assertEquals("created", confirmed.createdResourceId())
        for (body in listOf("not json", "[]", "{}", "{\"id\":null}", "{\"id\":42}", "{\"id\":\"../foreign\"}")) {
            assertNull(confirmed.copy(body = body).createdResourceId())
        }
    }

    private fun client(body: String): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
        override suspend fun get(path: String): AuthenticatedHttpResult = AuthenticatedHttpResult.Success(body)
        override suspend fun post(path: String, body: String): AuthenticatedHttpResult = error("No extra write")
    }
}
