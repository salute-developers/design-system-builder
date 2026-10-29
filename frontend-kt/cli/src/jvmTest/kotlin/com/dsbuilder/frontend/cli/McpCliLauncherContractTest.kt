package com.dsbuilder.frontend.cli

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.nio.file.Files
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private const val PROCESS_TIMEOUT_SECONDS = 10L

class McpCliLauncherContractTest {
    @Test
    fun mcpServeRespondsToInitializeAndToolsListOverSubprocessStdio() {
        val process = ProcessBuilder(
            javaBinary(),
            "-Duser.home=${Files.createTempDirectory("dsbuilder-mcp-test-home")}",
            "-cp",
            System.getProperty("java.class.path"),
            "com.dsbuilder.frontend.cli.MainKt",
            "mcp",
            "serve",
        )
            .directory(File(System.getProperty("java.io.tmpdir")))
            .start()
        try {
            val stdin = process.outputStream.bufferedWriter()
            val stdout = process.inputStream.bufferedReader()

            stdin.writeLine(initializeRequest())
            stdin.flush()
            val initializeResponse = stdout.readLine()

            stdin.writeLine(initializedNotification())
            stdin.writeLine(toolsListRequest())
            stdin.writeLine(contextRequest())
            stdin.flush()
            val toolsListResponse = stdout.readLine()
            val contextResponse = stdout.readLine()

            stdin.close()

            assertTrue(process.waitFor(PROCESS_TIMEOUT_SECONDS, TimeUnit.SECONDS), "MCP subprocess did not exit.")
            val stderr = process.errorStream.readBytes().decodeToString()
            assertEquals(0, process.exitValue(), stderr)
            assertTrue(initializeResponse.contains(""""id":1"""), initializeResponse)
            assertTrue(initializeResponse.contains(""""version":"0.2.0""""))
            assertTrue(toolsListResponse.contains(""""id":2"""), toolsListResponse)
            assertTrue(toolsListResponse.contains("design_system_get_context"), toolsListResponse)
            assertTrue(toolsListResponse.contains("project_get_status"), toolsListResponse)
            assertTrue(contextResponse.contains("AUTH_REQUIRED"), contextResponse)
            val registry = Json.parseToJsonElement(toolsListResponse).jsonObject
                .getValue("result").jsonObject.getValue("tools").jsonArray
            assertEquals(27, registry.size)
            val names = registry.map { it.jsonObject.getValue("name").jsonPrimitive.content }.toSet()
            assertTrue("component_configurations_list" in names)
            assertTrue("component_tokens_get" in names)
            assertTrue("documentation_publications_list" in names)
            val byName = registry.associateBy { it.jsonObject.getValue("name").jsonPrimitive.content }
            fun required(tool: String): List<String> = byName.getValue(tool).jsonObject
                .getValue("inputSchema").jsonObject.getValue("required").jsonArray
                .map { it.jsonPrimitive.content }
            assertEquals(listOf("appearanceId"), required("component_config_get"))
            assertEquals(listOf("componentId"), required("component_configurations_list"))
            assertEquals(listOf("bindingId"), required("code_binding_get"))
            assertEquals(listOf("path"), required("documentation_get_page"))
            assertTrue(toolsListResponse.contains("appearanceId"), toolsListResponse)
            assertTrue(toolsListResponse.contains("selectedValueIds"), toolsListResponse)
            assertTrue(toolsListResponse.contains("publicationId"), toolsListResponse)
            assertTrue(!initializeResponse.contains("Run DS Builder MCP tools."), initializeResponse)
            assertTrue(!toolsListResponse.contains("Run DS Builder MCP tools."), toolsListResponse)
            assertTrue(!toolsListResponse.contains("secret"), toolsListResponse)
        } finally {
            process.destroyForcibly()
        }
    }

    private fun javaBinary(): String =
        File(File(System.getProperty("java.home"), "bin"), "java").path

    private fun initializeRequest(): String =
        """
        {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"contract-test","version":"1"}}}
        """.trimIndent()

    private fun initializedNotification(): String =
        """
        {"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
        """.trimIndent()

    private fun toolsListRequest(): String =
        """
        {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
        """.trimIndent()

    private fun contextRequest(): String =
        """
        {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"design_system_get_context","arguments":{"designSystem":"dsbuilder://projects/project-headless/design-systems/ds-headless?version=1.0.0&platform=compose"}}}
        """.trimIndent()
}

private fun java.io.BufferedWriter.writeLine(value: String) {
    write(value)
    newLine()
}
