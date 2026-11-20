package com.dsbuilder.app.presentation

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.dsbuilder.app.GatewayConfiguration
import com.dsbuilder.consent.di.ConsentRuntime
import com.dsbuilder.consent.presentation.consentRoutes
import com.dsbuilder.identity.auth.application.GatewayAuthorizer
import com.dsbuilder.identity.auth.application.usecase.GatewayAuthDecision
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.calllogging.CallLogging
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.routing.routing
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import org.testcontainers.containers.PostgreSQLContainer
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class ConsentGatewayIntegrationTest {
    @Test fun realHttpGatewayPersistsOwnHistoryAcrossRestartAndNeverLogsTheKey() = runBlocking {
        val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine")
        postgres.start()
        val logs = ListAppender<ILoggingEvent>().apply { start() }
        val logger = LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger
        logger.addAppender(logs)
        val key = "d".repeat(64)
        val requestId = UUID.randomUUID().toString()
        try {
            HttpClient(CIO).use { client ->
                repeat(2) { launch ->
                    val runtime = ConsentRuntime(
                        MapApplicationConfig(
                            "database.url" to postgres.jdbcUrl,
                            "database.username" to postgres.username,
                            "database.password" to postgres.password,
                        ),
                    )
                    val authorizer = object : GatewayAuthorizer {
                        override suspend fun user(authorization: String?) = GatewayAuthDecision.Unauthorized("missing")
                        override suspend fun project(authorization: String?, projectId: String) = user(authorization)
                    }
                    val server = embeddedServer(Netty, port = 0, host = "127.0.0.1") {
                        install(CallLogging)
                        install(ContentNegotiation) { json() }
                        installPublicGateway(GatewayConfiguration.fromEnvironment(emptyMap()), authorizer)
                        install(RequestBodyLimit)
                        routing { consentRoutes(runtime.history) }
                    }.start(wait = false)
                    try {
                        val port = server.engine.resolvedConnectors().single().port
                        val base = "http://127.0.0.1:$port"
                        val path = "$base/api/privacy/analytics/consent"
                        val state = client.get("$path?client_group=web") { header("X-Consent-Key", key) }
                        assertEquals(HttpStatusCode.OK, state.status)
                        val decoded = Json.parseToJsonElement(state.bodyAsText()).jsonObject
                        val current = decoded.getValue("current").jsonObject
                        assertEquals(if (launch == 0) "0" else "1", current.getValue("revision").jsonPrimitive.content)
                        val policy = runtime.history.policy("web")
                        val body = """{
                            "request_id":"$requestId","client_group":"web","decision":"granted",
                            "expected_revision":0,"policy_version":"${policy.version}","policy_sha256":"${policy.sha256}"
                        }"""
                        val result = client.post(path) {
                            header("X-Consent-Key", key)
                            setBody(body)
                        }
                        assertEquals(if (launch == 0) HttpStatusCode.Created else HttpStatusCode.OK, result.status)
                        assertFalse(result.bodyAsText().contains(key))
                        val other = client.get("$path?client_group=web") { header("X-Consent-Key", "e".repeat(64)) }
                        val own = Json.parseToJsonElement(other.bodyAsText()).jsonObject.getValue("current").jsonObject
                        assertEquals("0", own.getValue("revision").jsonPrimitive.content)
                        assertEquals(
                            HttpStatusCode.Forbidden,
                            client.get("$path?client_group=web") {
                                header("Origin", "https://unknown.example")
                                header("X-Consent-Key", key)
                            }.status,
                        )
                        assertEquals(HttpStatusCode.NotFound, client.get("$path/history").status)
                    } finally {
                        server.stop(0, 1000)
                        runtime.close()
                    }
                }
            }
            assertFalse(logs.list.any { it.formattedMessage.contains(key) })
        } finally {
            logger.detachAppender(logs)
            logs.stop()
            postgres.stop()
        }
    }
}
