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
            stdin.flush()
            val toolsListResponse = stdout.readLine()

            stdin.close()

            assertTrue(process.waitFor(PROCESS_TIMEOUT_SECONDS, TimeUnit.SECONDS), "MCP subprocess did not exit.")
            val stderr = process.errorStream.readBytes().decodeToString()
            assertEquals(0, process.exitValue(), stderr)
            assertTrue(initializeResponse.contains(""""id":1"""), initializeResponse)
            assertTrue(initializeResponse.contains(""""version":"0.1.0""""))
            assertTrue(toolsListResponse.contains(""""id":2"""), toolsListResponse)
            assertTrue(toolsListResponse.contains("design_system_get_context"), toolsListResponse)
            assertTrue(toolsListResponse.contains("project_get_status"), toolsListResponse)
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
}

private fun java.io.BufferedWriter.writeLine(value: String) {
    write(value)
    newLine()
}
