package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class ApiUrlResolverProjectEnvTest {
    @Test
    fun resolvesArgumentThenProcessThenProjectThenDefault() {
        val project = EnvironmentReader { name -> "https://project.test".takeIf { name == API_URL_ENV } }
        val process = ApiUrlResolver(
            EnvironmentReader { name -> "https://process.test".takeIf { name == API_URL_ENV } },
        )
        assertEquals("https://argument.test", process.resolve("https://argument.test", project).value)
        assertEquals("https://process.test", process.resolve(null, project).value)

        val emptyProcess = ApiUrlResolver(EnvironmentReader { null })
        assertEquals("https://project.test", emptyProcess.resolve(null, project).value)
        assertIs<WriteApiUrlResult.Resolved>(emptyProcess.resolveForWrite(null, project))
        assertEquals(DEFAULT_API_URL, emptyProcess.resolve(null).value)
        assertIs<WriteApiUrlResult.Rejected>(emptyProcess.resolveForWrite(null))
    }
}
