package com.dsbuilder.frontend.core.process

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class ProcessRequestTest {
    @Test
    fun defaultsInheritStdioAndAddNoEnvironment() {
        val request = ProcessRequest(
            executable = "/usr/bin/true",
            args = listOf("--version"),
            workingDirectory = "/work",
        )

        assertTrue(request.inheritStdio)
        assertEquals(emptyMap(), request.environment)
        assertEquals(listOf("/usr/bin/true", "--version"), request.commandLine)
    }

    @Test
    fun executableMustBeAbsolute() {
        val error = assertFailsWith<IllegalArgumentException> {
            ProcessRequest(executable = "gradlew", args = emptyList(), workingDirectory = "/work")
        }

        assertTrue(error.message.orEmpty().contains("absolute"), error.message)
    }

    @Test
    fun workingDirectoryMustBeAbsolute() {
        assertFailsWith<IllegalArgumentException> {
            ProcessRequest(executable = "/usr/bin/true", args = emptyList(), workingDirectory = "relative/dir")
        }
    }

    @Test
    fun environmentKeysMustNotBeBlank() {
        assertFailsWith<IllegalArgumentException> {
            ProcessRequest(
                executable = "/usr/bin/true",
                args = emptyList(),
                workingDirectory = "/work",
                environment = mapOf(" " to "value"),
            )
        }
    }

    @Test
    fun runnerIsASingleFunctionPortAndCanBeFakedWithALambda() {
        val requests = mutableListOf<ProcessRequest>()
        val runner = ProcessRunner { request ->
            requests += request
            ProcessResult(exitCode = request.args.size, output = "")
        }

        val first = runner.run(ProcessRequest("/bin/a", listOf("x"), "/work"))
        val second = runner.run(ProcessRequest("/bin/b", listOf("x", "y"), "/work"))

        assertEquals(1, first.exitCode)
        assertEquals(2, second.exitCode)
        assertEquals(listOf("/bin/a", "/bin/b"), requests.map { it.executable })
    }
}
