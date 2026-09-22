package com.dsbuilder.frontend.cli

import java.io.File
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
            assertTrue(initializeResponse.contains(""""version":"0.1.0""""))
            assertTrue(toolsListResponse.contains(""""id":2"""), toolsListResponse)
            assertTrue(toolsListResponse.contains("design_system_get_context"), toolsListResponse)
            assertTrue(toolsListResponse.contains("project_get_status"), toolsListResponse)
            assertTrue(contextResponse.contains("project-headless"), contextResponse)
            assertTrue(contextResponse.contains("explicit-link"), contextResponse)
            assertTrue(toolsListResponse.contains("components.basic-button"), toolsListResponse)
            assertTrue(toolsListResponse.contains("component-style"), toolsListResponse)
            assertTrue(toolsListResponse.contains("The value component is not valid"), toolsListResponse)
            assertTrue(toolsListResponse.contains("\"enum\":[\"component-style\",\"token\"]"), toolsListResponse)
            assertTrue(toolsListResponse.contains("BasicButton.S.Accent"), toolsListResponse)
            assertTrue(toolsListResponse.contains("android for Compose"), toolsListResponse)
            assertTrue(
                toolsListResponse.contains("queries such as BasicButton or button may be empty"),
                toolsListResponse,
            )
            assertTrue(toolsListResponse.contains("\"enum\":[\"light\",\"dark\"]"), toolsListResponse)
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
        {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"design_system_get_context","arguments":{"designSystem":"dsbuilder://projects/project-headless/design-systems/ds-headless?version=1.0&platform=compose"}}}
        """.trimIndent()
}

private fun java.io.BufferedWriter.writeLine(value: String) {
    write(value)
    newLine()
}
