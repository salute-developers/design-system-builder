package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.analytics.Analytics
import com.dsbuilder.frontend.core.analytics.AnalyticsEvent
import com.dsbuilder.frontend.core.analytics.AnalyticsFlushResult
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ConfiguredAnalyticsTest {
    @Test fun ciDisablesBothChannelsEvenForAnEnabledBuild() {
        for (ci in listOf("true", "TRUE", "1")) {
            val factory = defaultAnalyticsSession(
                EnvironmentReader { name -> if (name == "CI") ci else null },
                enabled = true,
            ) { _, _ -> error("CI must not create the platform analytics client") }
            factory.record("cli", CLI_ANALYTICS_OPERATIONS, "status", "success")
            factory.record("mcp", setOf("project_get_status"), "project_get_status", "success")
            factory.finish()
        }
    }

    @Test fun clientEventContainsOnlyOperationAndOutcome() {
        val event = operationEvent("cli", "status", "failure")
        assertEquals(setOf("operation", "outcome"), event.properties.keys)
        assertEquals("cli_operation_finished", event.name)
    }

    @Test fun channelsChooseTheirOwnTokenAndOneCounter() {
        val tokens = mutableMapOf<String, String>()
        val events = mutableListOf<AnalyticsEvent>()
        val factory = defaultAnalyticsSession(EnvironmentReader { null }) { config, channel ->
            assertEquals(BuiltAnalyticsConfig.COUNTER_ID, config.counterId)
            tokens[channel] = config.token
            object : Analytics {
                override fun track(event: AnalyticsEvent) { events += event }
                override suspend fun flush(timeoutMillis: Long) = AnalyticsFlushResult.COMPLETED
                override fun close() = Unit
            }
        }
        factory.record("cli", CLI_ANALYTICS_OPERATIONS, "status", "success")
        factory.record("mcp", setOf("project_get_status"), "project_get_status", "failure")
        factory.finish()
        if (BuiltAnalyticsConfig.enabled) {
            assertEquals(2, tokens.size)
            assertTrue(tokens["cli"] == BuiltAnalyticsConfig.CLI_TOKEN, "CLI selects its own token")
            assertTrue(tokens["mcp"] == BuiltAnalyticsConfig.MCP_TOKEN, "MCP selects its own token")
            assertEquals(listOf("cli_operation_finished", "mcp_tool_finished"), events.map { it.name })
        } else {
            assertTrue(tokens.isEmpty())
            assertTrue(events.isEmpty())
        }
    }

    @Test fun optOutPrecedesPlatformFactoryAndStorage() {
        for (disabled in listOf("DSBUILDER_ANALYTICS_DISABLED", "DO_NOT_TRACK")) {
            val factory =
                defaultAnalyticsSession(
                    EnvironmentReader { name -> if (name == disabled) "1" else null },
                    enabled = true,
                ) {
                        _, _ ->
                    error("Must not create HTTP client or storage")
                }
            factory.record("cli", CLI_ANALYTICS_OPERATIONS, "status", "success")
            factory.finish()
        }
    }
}
