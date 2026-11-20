package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.ConfirmationCheck
import com.dsbuilder.ai.chat.application.PendingOperation
import com.dsbuilder.ai.chat.domain.ChatScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs

class HmacConfirmationSignerTest {
    private val now = Instant.parse("2026-11-17T10:00:00Z")
    private val clock = Clock.fixed(now, ZoneOffset.UTC)
    private val scope = ChatScope("user", "project", "ds")
    private val operation = PendingOperation(
        callId = "c1",
        tool = "component_property_reset",
        arguments = JsonObject(mapOf("b" to JsonPrimitive(1), "a" to JsonPrimitive("x"))),
        idempotencyKey = "key",
        draftId = "draft",
        scope = scope,
        expiresAt = now.plusSeconds(600),
    )

    @Test
    fun validTokenRoundTrips() {
        val signer = HmacConfirmationSigner(clock)
        assertEquals(
            operation,
            assertIs<ConfirmationCheck.Valid>(signer.verify(signer.issue(operation), scope)).operation,
        )
    }

    @Test
    fun anyChangedFieldBreaksTheSignature() {
        val signer = HmacConfirmationSigner(clock)
        val token = signer.issue(operation)
        val payload = Json.parseToJsonElement(String(Base64.getUrlDecoder().decode(token.substringBefore('.'))))
            as JsonObject
        for (field in payload.keys - "kid") {
            val changed = JsonObject(payload + (field to JsonPrimitive("tampered")))
            val forged = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(HmacConfirmationSigner.canonical(changed).toByteArray()) + "." +
                token.substringAfter('.')
            assertIs<ConfirmationCheck.Invalid>(signer.verify(forged, scope), field)
        }
    }

    @Test
    fun unknownKeyIdMeansRestartAndExpiredTimeMeansExpired() {
        val token = HmacConfirmationSigner(clock).issue(operation)
        assertIs<ConfirmationCheck.Expired>(HmacConfirmationSigner(clock).verify(token, scope))
        val later =
            HmacConfirmationSigner(Clock.fixed(now.plusSeconds(601), ZoneOffset.UTC), keyId = "k", key = ByteArray(32))
        assertIs<ConfirmationCheck.Expired>(
            later.verify(HmacConfirmationSigner(clock, "k", ByteArray(32)).issue(operation), scope),
        )
    }

    @Test
    fun foreignScopeIsInvalid() {
        val signer = HmacConfirmationSigner(clock)
        assertIs<ConfirmationCheck.Invalid>(
            signer.verify(signer.issue(operation), scope.copy(designSystemId = "other")),
        )
        assertIs<ConfirmationCheck.Invalid>(signer.verify(signer.issue(operation), scope.copy(userId = "other")))
    }

    @Test
    fun canonicalJsonDoesNotDependOnKeyOrder() {
        val a = Json.parseToJsonElement("""{"b":1,"a":{"y":2,"x":1}}""")
        val b = Json.parseToJsonElement("""{"a":{"x":1,"y":2},"b":1}""")
        assertEquals(HmacConfirmationSigner.canonical(a), HmacConfirmationSigner.canonical(b))
    }

    @Test
    fun tokenHasNoBearer() {
        val token = HmacConfirmationSigner(clock).issue(operation)
        assertFalse("Bearer" in String(Base64.getUrlDecoder().decode(token.substringBefore('.'))))
    }
}
