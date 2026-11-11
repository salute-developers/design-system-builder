package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ConsentSessionTest {
    private val policy = ConsentPolicyDto("cli_mcp-v1", "a".repeat(64), "Короткое уведомление")
    private val receipt = ConsentReceiptDto(1, "granted", policy.version, policy.sha256, "2026-11-10T00:00:00Z")
    private fun response(allowed: Boolean = true) = Json.encodeToString(
        ConsentResponseDto(
            policy,
            ConsentStateDto(1, allowed, receipt),
            receipt,
        ),
    )
    private fun fixture(
        lock: com.dsbuilder.frontend.core.auth.CredentialStoreLock = JvmCredentialStoreLock,
        block: suspend (CliConsentFile) -> Unit,
    ) = runBlocking {
        val directory = Files.createTempDirectory("dsbuilder-consent-test-").toFile()
        val fs = object : CredentialStoreFileSystem by JvmCredentialStoreFileSystem {
            override fun homeDirectory() = directory.path
        }
        val file = CliConsentFile(fs, lock, "test") { "b".repeat(64) }
        try { block(file) } finally { directory.deleteRecursively() }
    }

    @Test fun oneCheckPerLaunchAndImmediateLocalWithdrawal() = fixture { file ->
        file.change { it.copy(decision = "granted", revision = 1, receipt = receipt) }
        var requests = 0
        val session =
            CliConsentSession(
                file,
                {
                    HttpClient(
                        MockEngine {
                            requests++
                            respond(response())
                        },
                    )
                },
                "https://example.test",
                true,
            )
        try {
            assertFalse(session.allowed())
            session.prepare()
            session.prepare()
            assertTrue(session.allowed())
            assertEquals(1, requests)
            file.change { it.copy(decision = "withdrawn") }
            assertFalse(session.allowed())
            assertEquals(1, requests)
        } finally { session.close() }
    }

    @Test fun withdrawalDropsQueuedTransportBeforeHttp() = runBlocking {
        var sent = 0
        var permission = true
        val delegate = object : com.dsbuilder.frontend.analytics.metrica.MetricaTransport {
            override suspend fun send(request: com.dsbuilder.frontend.analytics.metrica.MetricaRequest): Boolean {
                sent++
                return true
            }
            override fun close() = Unit
        }
        val transport = ConsentMetricaTransport(delegate) { permission }
        transport.send(com.dsbuilder.frontend.analytics.metrica.MetricaRequest(emptyMap()))
        permission = false
        assertFalse(transport.send(com.dsbuilder.frontend.analytics.metrica.MetricaRequest(emptyMap())))
        assertEquals(1, sent)
    }

    @Test fun heldLocalLockCannotDelayAutomaticChecksForThirtySeconds() {
        var held = false
        val lock = object : com.dsbuilder.frontend.core.auth.CredentialStoreLock {
            override suspend fun <T> withLock(lockPath: String, block: suspend () -> T): T {
                if (held) delay(30_000)
                return JvmCredentialStoreLock.withLock(lockPath, block)
            }
        }
        fixture(lock) { file ->
            file.change { it.copy(decision = "granted", revision = 1, receipt = receipt) }
            held = true
            val session = CliConsentSession(
                file,
                { error("HTTP must not start while the file is locked") },
                "https://example.test",
                true,
            )
            try {
                kotlinx.coroutines.withTimeout(2000) { session.prepare() }
                assertFalse(session.allowed())
            } finally { session.close() }
        }
    }

    @Test fun explicitEnableReplaysAnUncertainGrantBeforeCreatingAnotherRequest() = fixture { file ->
        val pending = ConsentDecisionDto(
            "00000000-0000-4000-8000-000000000001",
            "granted",
            0,
            policy.version,
            policy.sha256,
        )
        file.change { it.copy(decision = "granted", pending = pending) }
        val bodies = mutableListOf<String>()
        val session = CliConsentSession(
            file,
            {
                HttpClient(
                    MockEngine { request ->
                        bodies += (request.body as io.ktor.http.content.TextContent).text
                        respond(response())
                    },
                )
            },
            "https://example.test",
            true,
        )
        try {
            session.enable { error("The previous explicit choice must be resolved without a new question") }
            assertEquals(1, bodies.size)
            assertTrue(bodies.single().contains(pending.requestId))
            assertEquals(null, file.read()?.pending)
            assertTrue(session.allowed())
        } finally { session.close() }
    }

    @Test fun unknownMcpAndCiNeverPromptOrCreateHttp() = fixture { file ->
        val mcp = CliConsentSession(
            file,
            { error("No HTTP before a choice") },
            "https://example.test",
            true,
        )
        mcp.prepare()
        assertFalse(mcp.allowed())
        assertEquals(null, file.read())
        val ci = CliConsentSession(file, { error("No HTTP in CI") }, "https://example.test", false)
        ci.prepare { error("No automatic questions in CI") }
        assertFalse(ci.allowed())
        assertEquals(null, file.read())
    }

    @Test fun timeoutPreservesChoiceAndDoesNotRetry() = fixture { file ->
        file.change { it.copy(decision = "granted", revision = 1, receipt = receipt) }
        var requests = 0
        val session =
            CliConsentSession(
                file,
                {
                    HttpClient(
                        MockEngine {
                            requests++
                            delay(2000)
                            respond(response())
                        },
                    )
                },
                "https://example.test",
                true,
            )
        try {
            session.prepare()
            session.prepare()
            assertFalse(session.allowed())
            assertEquals(1, requests)
            assertEquals("granted", file.read()?.decision)
        } finally { session.close() }
    }

    @Test fun offlineWithdrawalIsPersistedForNextLaunch() = fixture { file ->
        file.change { it.copy(decision = "granted", revision = 1, receipt = receipt) }
        val session =
            CliConsentSession(
                file,
                {
                    HttpClient(MockEngine { respond("", HttpStatusCode.ServiceUnavailable) })
                },
                "https://example.test",
                true,
            )
        try {
            session.disable()
            assertFalse(session.allowed())
            assertEquals("withdrawn", file.read()?.decision)
            assertEquals("withdrawn", file.read()?.pending?.decision)
        } finally { session.close() }
    }

    @Test fun oldGetCannotOverrideConcurrentWithdrawal() = fixture { file ->
        file.change { it.copy(decision = "granted", revision = 1, receipt = receipt) }
        val started = CompletableDeferred<Unit>()
        val finish = CompletableDeferred<Unit>()
        val session =
            CliConsentSession(
                file,
                {
                    HttpClient(
                        MockEngine {
                            started.complete(Unit)
                            finish.await()
                            respond(response())
                        },
                    )
                },
                "https://example.test",
                true,
            )
        try {
            kotlinx.coroutines.coroutineScope {
                val checking = async { session.prepare() }
                started.await()
                file.change { it.copy(decision = "withdrawn") }
                finish.complete(Unit)
                checking.await()
            }
            assertFalse(session.allowed())
            assertEquals("withdrawn", file.read()?.decision)
        } finally { session.close() }
    }
}
