package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.platform.ToolchainId
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Команды делегирования: help не требует ни проекта, ни инструментов, а запуск без
 * установленного инструмента отказывает детерминированно и ничего не запускает.
 */
class PlatformCommandsCliTest {
    @Test
    fun rootHelpListsToolchain() {
        val result = cli().execute(listOf("--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("toolchain"), result.output)
    }

    @Test
    fun themeHelpListsGenerate() {
        val result = cli().execute(listOf("theme", "--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("generate"), result.output)
    }

    @Test
    fun componentsHelpListsGenerate() {
        val result = cli().execute(listOf("components", "--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("generate"), result.output)
    }

    @Test
    fun generateHelpListsPlatformOutputAndTool() {
        listOf(listOf("theme", "generate", "--help"), listOf("components", "generate", "--help")).forEach { args ->
            val result = cli().execute(args)

            assertEquals(0, result.exitCode, result.output)
            listOf("--platform", "--output", "--tool")
                .forEach { assertTrue(result.output.contains(it), "$it отсутствует в help:\n${result.output}") }
        }
    }

    @Test
    fun docsGenerateHelpOffersReadyTreeAndAggregationSwitch() {
        val result = cli().execute(listOf("docs", "generate", "--help"))

        assertEquals(0, result.exitCode, result.output)
        listOf("--docs-dir", "--no-aggregate", "--platform", "--tool")
            .forEach { assertTrue(result.output.contains(it), "$it отсутствует в help:\n${result.output}") }
    }

    @Test
    fun initHelpOffersPlatform() {
        val result = cli().execute(listOf("init", "--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("--platform"), result.output)
    }

    @Test
    fun unknownPlatformIsRejectedByTheOptionItself() {
        val fileSystem = RecordingFileSystem()

        val result = cli(fileSystem).execute(listOf("theme", "generate", "--platform", "ios"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("swiftui"), result.output)
        assertTrue(fileSystem.reads.isEmpty(), "прочитаны файлы: ${fileSystem.reads}")
    }

    @Test
    fun generateWithoutInstalledToolFailsWithoutRunningAnything() {
        val fileSystem = RecordingFileSystem(
            files = mapOf(
                "/repo/.sdds/config.json" to CONFIG_JSON,
            ),
        )
        val started = mutableListOf<ProcessRequest>()

        val result = cli(
            fileSystem,
            ProcessRunner {
                started += it
                ProcessResult(0, "")
            },
        )
            .execute(listOf("theme", "generate"))

        assertEquals(1, result.exitCode)
        // Платформа взята из config, делегат найден, но инструмента на машине нет.
        assertTrue(result.output.contains("dsbuilder-ios was not found"), result.output)
        assertTrue(result.output.contains("--tool"), result.output)
        assertTrue(started.isEmpty(), "запущен процесс без установленного инструмента")
    }

    @Test
    fun compositionRootRegistersTheIosDelegateForSwiftUiOnly() {
        val registry = cli().platformDelegateRegistry()

        assertEquals(listOf(ToolchainId("ios")), registry.all.map { it.toolchain })
        assertEquals(ToolchainId("ios"), registry.forPlatform(TargetPlatform.SWIFT_UI)?.toolchain)
        listOf(TargetPlatform.COMPOSE, TargetPlatform.ANDROID_VIEW, TargetPlatform.REACT)
            .forEach { platform -> assertNull(registry.forPlatform(platform)) }
    }

    @Test
    fun compositionRootRegistersTheIosInstaller() {
        val registry = cli().toolchainInstallerRegistry()

        assertEquals(listOf(ToolchainId("ios")), registry.all.map { it.toolchain })
        assertNull(registry.forToolchain(ToolchainId("android")))
    }

    @Test
    fun toolchainInstallRefusesAToolchainItCannotInstall() {
        val result = cli().execute(listOf("toolchain", "install", "android"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("android") && result.output.contains("ios"), result.output)
    }

    @Test
    fun toolchainListShowsWhatTheClientCanDrive() {
        val result = cli().execute(listOf("toolchain", "list"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Toolchain: ios"), result.output)
        assertTrue(result.output.contains("swiftui"), result.output)
        assertTrue(result.output.contains("theme generation"), result.output)
    }

    @Test
    fun toolchainDoctorFailsWhenTheToolIsNotInstalled() {
        val result = cli().execute(listOf("toolchain", "doctor"))

        // Непригодный инструмент — ненулевой код: в CI это единственный сигнал.
        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("Status: missing"), result.output)
        assertTrue(result.output.contains("dsbuilder-ios was not found"), result.output)
    }

    @Test
    fun toolchainDoctorRejectsPlatformWithoutToolchain() {
        val result = cli().execute(listOf("toolchain", "doctor", "--platform", "compose"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("compose"), result.output)
    }

    private fun cli(
        fileSystem: WorkspaceFileSystem = RecordingFileSystem(),
        processRunner: ProcessRunner = ProcessRunner { ProcessResult(exitCode = 0, output = "") },
    ) = DsBuilderCli(
        ClientRuntime(
            fileSystem = fileSystem,
            environmentReader = EnvironmentReader { null },
            httpClientFactory = object : AuthenticatedHttpClientFactory {
                override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
                    object : AuthenticatedHttpClient {
                        override fun get(path: String): AuthenticatedHttpResult =
                            AuthenticatedHttpResult.Failure("unexpected")

                        override fun post(path: String, body: String): AuthenticatedHttpResult =
                            AuthenticatedHttpResult.Failure("unexpected")
                    }
            },
            processRunner = processRunner,
        ),
    )
}

private val CONFIG_JSON = """
    {
      "projectId": "project-a",
      "designSystemId": "ds-a",
      "credential": { "type": "env", "name": "DSBUILDER_API_KEY" },
      "platforms": ["swiftui"]
    }
""".trimIndent()

/**
 * Файловая система, запоминающая обращения: help и ошибки ввода не должны читать файлы.
 */
private class RecordingFileSystem(
    private val files: Map<String, String> = emptyMap(),
) : WorkspaceFileSystem {
    val reads: MutableList<String> = mutableListOf()

    override fun currentWorkingDirectory(): String = "/repo"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String = "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String =
        if (path.startsWith("/")) path else "${currentWorkingDirectory()}/$path"

    override fun exists(path: String): Boolean {
        reads += path
        return path in files
    }

    override fun isDirectory(path: String): Boolean = false

    override fun createDirectories(path: String) = Unit

    override fun listFiles(path: String): List<String> = emptyList()

    override fun readText(path: String): String {
        reads += path
        return files[path].orEmpty()
    }

    override fun readBytes(path: String): ByteArray = byteArrayOf()

    override fun writeText(path: String, text: String) = Unit

    override fun writeBytes(path: String, bytes: ByteArray) = Unit

    override fun sink(path: String): BufferedSink = okio.Buffer()

    override fun deleteFile(path: String) = Unit
}
