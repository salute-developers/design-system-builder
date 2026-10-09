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
    fun dsHelpListsFetchAndGenerate() {
        val root = cli().execute(listOf("--help"))
        val ds = cli().execute(listOf("ds", "--help"))

        assertTrue(root.output.contains("ds"), root.output)
        assertTrue(ds.output.contains("fetch") && ds.output.contains("generate"), ds.output)
    }

    @Test
    fun dsGenerateRunsTheWebDesignSystemScriptOnce() {
        val fileSystem = RecordingFileSystem(
            files = mapOf(
                "/repo/.sdds/config.json" to CONFIG_JSON.replace("swiftui", "react"),
                "/repo/js/cli/package.json" to "{}",
                "/usr/bin/npm" to "",
            ),
        )
        val started = mutableListOf<ProcessRequest>()

        val result = cli(
            fileSystem,
            ProcessRunner {
                started += it
                ProcessResult(0, "")
            },
            environment = mapOf("DSBUILDER_WEB_TOOL" to "/repo/js/cli", "PATH" to "/usr/bin"),
        ).execute(listOf("ds", "generate", "--output", "/repo/web", "--", "--package"))

        assertEquals(0, result.exitCode, result.output)
        // Тема и компоненты — один запуск: с `--package` он собирает один пакет, а не два.
        // Первый процесс — проверка инструмента (`npm --version`), второй — сама генерация.
        assertEquals(
            listOf("run", "generate:ds", "--", "--sdds", "/repo/.sdds", "--out", "/repo/web", "--package"),
            started.single { it.args != listOf("--version") }.args,
        )
    }

    @Test
    fun dsGenerateForSwiftUiRunsTheThemeGeneration() {
        val fileSystem = RecordingFileSystem(
            files = mapOf(
                "/repo/.sdds/config.json" to CONFIG_JSON,
                "/tools/dsbuilder-ios" to "",
            ),
        )
        val started = mutableListOf<ProcessRequest>()

        val result = cli(
            fileSystem,
            ProcessRunner {
                started += it
                ProcessResult(0, "")
            },
            environment = mapOf("DSBUILDER_IOS_TOOL" to "/tools/dsbuilder-ios"),
        ).execute(listOf("ds", "generate"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals(
            listOf("theme", "generate", "--sdds", "/repo/.sdds"),
            started.single { it.args != listOf("--version") }.args,
        )
    }

    @Test
    fun compositionRootRegistersTheIosDelegateForSwiftUiOnly() {
        val registry = cli().platformDelegateRegistry()

        assertEquals(ToolchainId("ios"), registry.forPlatform(TargetPlatform.SWIFT_UI)?.toolchain)
    }

    @Test
    fun compositionRootRegistersTheAndroidDelegateForComposeAndAndroidView() {
        val registry = cli().platformDelegateRegistry()

        assertEquals(
            setOf(ToolchainId("ios"), ToolchainId("android"), ToolchainId("web")),
            registry.all.map { it.toolchain }.toSet(),
        )
        assertEquals(ToolchainId("android"), registry.forPlatform(TargetPlatform.COMPOSE)?.toolchain)
        assertEquals(ToolchainId("android"), registry.forPlatform(TargetPlatform.ANDROID_VIEW)?.toolchain)
    }

    @Test
    fun compositionRootRegistersTheWebDelegateForReact() {
        val registry = cli().platformDelegateRegistry()

        assertEquals(ToolchainId("web"), registry.forPlatform(TargetPlatform.REACT)?.toolchain)
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
    fun toolchainDoctorChecksOnlyTheWebToolchainForReact() {
        val result = cli().execute(listOf("toolchain", "doctor", "--platform", "react"))

        // Каталог web-генератора не задан: отказ приходит от doctor'а делегата и подсказывает, как его задать.
        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("Toolchain: web"), result.output)
        assertTrue(result.output.contains("DSBUILDER_WEB_TOOL"), result.output)
    }

    @Test
    fun toolchainDoctorChecksOnlyTheAndroidToolchainForCompose() {
        val result = cli().execute(listOf("toolchain", "doctor", "--platform", "compose"))

        // Инструмент недоступен в тестовом окружении (нет реального gradlew), но toolchain для
        // compose теперь зарегистрирован — отказ приходит от doctor'а, а не от отсутствия делегата.
        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("Toolchain: android"), result.output)
        assertTrue(result.output.contains("Status: missing"), result.output)
    }

    private fun cli(
        fileSystem: WorkspaceFileSystem = RecordingFileSystem(),
        processRunner: ProcessRunner = ProcessRunner { ProcessResult(exitCode = 0, output = "") },
        environment: Map<String, String> = emptyMap(),
    ) = DsBuilderCli(
        ClientRuntime(
            fileSystem = fileSystem,
            environmentReader = EnvironmentReader { environment[it] },
            httpClientFactory = object : AuthenticatedHttpClientFactory {
                override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
                    object : AuthenticatedHttpClient {
                        override suspend fun get(path: String): AuthenticatedHttpResult =
                            AuthenticatedHttpResult.Failure("unexpected")

                        override suspend fun post(path: String, body: String): AuthenticatedHttpResult =
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
