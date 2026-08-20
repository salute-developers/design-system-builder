package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.CliRuntime
import com.dsbuilder.frontend.cli.DsBuilderCli
import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClient
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ComponentsCliCommandTest {
    @Test
    fun rootHelpListsComponents() {
        val result = cli().execute(listOf("--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("components"), result.output)
    }

    @Test
    fun componentsHelpListsPush() {
        val result = cli().execute(listOf("components", "--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("push"), result.output)
    }

    @Test
    fun pushHelpListsOptions() {
        val result = cli().execute(listOf("components", "push", "--help"))

        assertEquals(0, result.exitCode, result.output)
        listOf("--from", "--api-key", "--api-url", "--apply", "--dry-run")
            .forEach { assertTrue(result.output.contains(it), "$it отсутствует в help:\n${result.output}") }
    }

    /**
     * Удалённый источник снят: пакет берётся только из директории.
     */
    @Test
    fun pushHelpDoesNotOfferRemoteSource() {
        val result = cli().execute(listOf("components", "push", "--help"))

        assertTrue(!result.output.contains("--design-system"), result.output)
        assertTrue(!result.output.contains("--version"), result.output)
    }

    @Test
    fun pushHelpDoesNotOfferSkipNameCheck() {
        val result = cli().execute(listOf("components", "push", "--help"))

        assertTrue(!result.output.contains("--skip-name-check"), result.output)
    }

    @Test
    fun helpNeedsNeitherConfigNorBackend() {
        val fileSystem = RecordingFileSystem()
        var backendCalls = 0

        val result = cli(fileSystem) { backendCalls++ }.execute(listOf("components", "push", "--help"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals(0, backendCalls, "help обратился к backend")
        assertTrue(fileSystem.reads.isEmpty(), "help прочитал файлы: ${fileSystem.reads}")
    }

    @Test
    fun applyAndDryRunTogetherAreRejected() {
        val result = cli().execute(listOf("components", "push", "--apply", "--dry-run"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("--apply") && result.output.contains("--dry-run"), result.output)
    }

    @Test
    fun optionErrorsDoNotTouchBackendOrFiles() {
        val fileSystem = RecordingFileSystem()
        var backendCalls = 0

        val result = cli(fileSystem) { backendCalls++ }.execute(listOf("components", "push", "--apply", "--dry-run"))

        assertEquals(1, result.exitCode)
        assertEquals(0, backendCalls)
        assertTrue(fileSystem.reads.isEmpty(), "прочитаны файлы: ${fileSystem.reads}")
    }

    @Test
    fun pushWithoutExplicitApiUrlIsRejectedBeforeAnyRequest() {
        val fileSystem = RecordingFileSystem()
        var backendCalls = 0

        val result = cli(fileSystem) { backendCalls++ }.execute(listOf("components", "push"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("--api-url"), result.output)
        assertTrue(result.output.contains("DSBUILDER_API_URL"), result.output)
        assertEquals(0, backendCalls, "запрос отправлен несмотря на умолчание API URL")
        assertTrue(fileSystem.reads.isEmpty(), "прочитан config, хотя URL отклонён: ${fileSystem.reads}")
    }

    private fun cli(
        fileSystem: CliFileSystem = RecordingFileSystem(),
        onBackendCall: () -> Unit = {},
    ) = DsBuilderCli(
        CliRuntime(
            fileSystem = fileSystem,
            environmentReader = EnvironmentReader { null },
            httpClientFactory = object : AuthenticatedHttpClientFactory {
                override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
                    object : AuthenticatedHttpClient {
                        override fun get(path: String): AuthenticatedHttpResult {
                            onBackendCall()
                            return AuthenticatedHttpResult.Failure("unexpected")
                        }

                        override fun post(path: String, body: String): AuthenticatedHttpResult {
                            onBackendCall()
                            return AuthenticatedHttpResult.Failure("unexpected")
                        }
                    }
            },
        ),
    )
}

/**
 * Файловая система, запоминающая обращения, чтобы проверить, что help ничего не читает.
 */
private class RecordingFileSystem : CliFileSystem {
    val reads: MutableList<String> = mutableListOf()

    override fun currentWorkingDirectory(): String = "/repo"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String = "${parent.trimEnd('/')}/$child"

    override fun exists(path: String): Boolean {
        reads += path
        return false
    }

    override fun createDirectories(path: String) = Unit

    override fun listFiles(path: String): List<String> = emptyList()

    override fun readText(path: String): String {
        reads += path
        return ""
    }

    override fun writeText(path: String, text: String) = Unit

    override fun deleteFile(path: String) = Unit
}
