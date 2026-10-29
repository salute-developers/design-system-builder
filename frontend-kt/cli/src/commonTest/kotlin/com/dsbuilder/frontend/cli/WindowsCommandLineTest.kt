package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class WindowsCommandLineTest {
    @Test
    fun directProcessQuotesSpacesAndEmbeddedQuotes() {
        assertEquals(
            "\"C:\\Program Files\\tool.exe\" \"a b\" \"a\\\"b\"",
            windowsExecutableCommandLine("C:\\Program Files\\tool.exe", listOf("a b", "a\"b")),
        )
    }

    @Test
    fun batchArgumentsKeepMetacharactersInsideQuotes() {
        assertEquals(
            "cmd.exe /d /v:off /s /c \"\"C:\\work space\\gradlew.bat\" \"a&b\" \"a|b\"\"",
            windowsBatchCommandLine("C:\\work space\\gradlew.bat", listOf("a&b", "a|b")),
        )
    }

    @Test
    fun batchExpansionAndQuoteCharactersAreRejected() {
        for (unsafe in listOf("safe\r\nwhoami", "x\"&whoami", "%PATH%", "^&whoami", "!PATH!")) {
            assertFailsWith<ProcessLaunchException> {
                windowsBatchCommandLine("C:\\gradlew.bat", listOf(unsafe))
            }
        }
    }
}
