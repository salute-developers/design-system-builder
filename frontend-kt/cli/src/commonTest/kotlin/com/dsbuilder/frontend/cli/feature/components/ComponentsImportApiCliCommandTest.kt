package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.DsBuilderCli
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Сквозные тесты `components import-api` через настоящий DI-граф CLI.
 *
 * Подменены только границы: файловая система (в памяти), процесс Gradle (пишет файл меты, как это
 * делает задача плагина) и HTTP.
 */
class ComponentsImportApiCliCommandTest {
    private val requests = mutableListOf<Pair<String, String>>()
    private val processes = mutableListOf<ProcessRequest>()

    @Test
    fun dryRunRunsGradleReadsTheMetaAndSendsOneRequest() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals(1, requests.size, "запросов должно быть ровно один: $requests")
        val (path, body) = requests.single()
        assertEquals("/api/projects/project-a/ds/component-config/import-api-meta", path)
        assertTrue(body.contains("\"dryRun\":true"), body)
        assertTrue(body.contains("\"platform\":\"compose\""), body)
        assertTrue(body.contains("\"designSystemId\":\"ds-a\""), body)
        assertTrue(processes.any { "readUikitComposeApiMeta" in it.args }, "задача меты не запущена: $processes")
        assertTrue(result.output.contains("Status: dry run"), result.output)
        assertTrue(result.output.contains("Components: 2"), result.output)
        assertTrue(result.output.contains("Properties: 3"), result.output)
        assertTrue(result.output.contains("Created components: 1"), result.output)
        assertTrue(!result.output.contains("secret-key"), "ключ попал в вывод:\n${result.output}")
    }

    @Test
    fun applySendsTheRequestAsNonDryRun() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend", "--apply"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(requests.single().second.contains("\"dryRun\":false"), requests.single().second)
        assertTrue(result.output.contains("Status: API meta imported"), result.output)
    }

    @Test
    fun printsTheTargetBeforeTheRequestGoesOut() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend"))

        listOf(
            "Platform: compose",
            "Source: /repo/build/theme-builder/components/uikit-compose-api-meta.json",
            "API URL: http://backend (from --api-url)",
            "Project: project-a",
            "Design system: ds-a",
        )
            .forEach { assertTrue(result.output.contains(it), "нет '$it' в выводе:\n${result.output}") }
    }

    @Test
    fun printsRejectionsAndTypeMismatches() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            report = REPORT_WITH_FINDINGS,
        )

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Rejected: 1"), result.output)
        assertTrue(result.output.contains("Box.odd: unknown property type: odd"), result.output)
        assertTrue(result.output.contains("Property type mismatches"), result.output)
        assertTrue(result.output.contains("Box.size: db=float, meta=dimension"), result.output)
    }

    @Test
    fun strictFailsOnRejectedProperties() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend", "--strict"),
            report = REPORT_WITH_FINDINGS,
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("Rejected: 1"), "отчёт не напечатан:\n${result.output}")
    }

    @Test
    fun strictPassesWhenNothingIsRejected() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend", "--strict"))

        assertEquals(0, result.exitCode, result.output)
    }

    @Test
    fun mapTypeIsAppliedToTheRequest() {
        run(listOf("components", "import-api", "--api-url", "http://backend", "--map-type", "dimension:float"))

        val body = requests.single().second
        assertTrue(!body.contains("\"type\":\"dimension\""), body)
        assertTrue(body.contains("\"type\":\"float\""), body)
    }

    @Test
    fun malformedMapTypeIsRejectedBeforeAnythingRuns() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend", "--map-type", "dimension"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("from:to"), result.output)
        assertTrue(processes.isEmpty() && requests.isEmpty())
    }

    @Test
    fun applyAndDryRunTogetherAreRejectedBeforeAnythingRuns() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend", "--apply", "--dry-run"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(processes.isEmpty() && requests.isEmpty())
    }

    @Test
    fun withoutAnExplicitApiUrlNothingIsRunOrSent() {
        val result = run(listOf("components", "import-api"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("--api-url"), result.output)
        assertTrue(processes.isEmpty(), "Gradle запущен без явного API URL: $processes")
        assertTrue(requests.isEmpty())
    }

    @Test
    fun anUnsupportedPlatformIsRefusedBeforeAnythingRuns() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            platform = "swiftui",
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("does not support platform 'swiftui'"), result.output)
        assertTrue(result.output.contains("Supported: compose, android-view"), result.output)
        assertTrue(processes.isEmpty() && requests.isEmpty())
    }

    @Test
    fun theExplicitPlatformOptionOverridesTheConfig() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend", "--platform", "compose"),
            platform = "android-view",
        )

        assertEquals(0, result.exitCode, result.output)
        assertEquals(1, requests.size)
    }

    @Test
    fun anEmptyMetaIsRefusedAndNothingIsSent() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend"), meta = "[]")

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("classpath"), result.output)
        assertTrue(requests.isEmpty(), "пустой манифест отправлен")
    }

    @Test
    fun aMissingMetaFileNamesTheExpectedPath() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend"), meta = null)

        assertEquals(1, result.exitCode, result.output)
        assertTrue(
            result.output.contains("/repo/build/theme-builder/components/uikit-compose-api-meta.json"),
            result.output,
        )
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aFailingGradleTaskFailsTheCommandAndSendsNothing() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            gradleExitCode = 1,
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("exit code 1"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun anAndroidViewProjectRunsTheViewMetaTaskAndSendsTheXmlPlatform() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            platform = "android-view",
        )

        assertEquals(0, result.exitCode, result.output)
        assertTrue(processes.any { "readUikitApiMeta" in it.args }, "задача меты View не запущена: $processes")
        assertTrue(processes.none { "readUikitComposeApiMeta" in it.args }, "запущена задача меты Compose")
        val (path, body) = requests.single()
        assertEquals("/api/projects/project-a/ds/component-config/import-api-meta", path)
        assertTrue(body.contains("\"platform\":\"xml\""), body)
        assertTrue(body.contains("\"platformNames\":[\"android:minWidth\",\"android:maxWidth\"]"), body)
        assertTrue(!body.contains("\"platformName\":"), body)
        assertTrue(body.contains("\"states\":[\"active\"]"), body)
    }

    @Test
    fun theViewTargetNamesTheViewMetaFileAndItsContents() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            platform = "android-view",
        )

        listOf(
            "Platform: android-view",
            "Source: $VIEW_META_PATH",
            "Components: 3",
            "Properties: 3",
            "States: 1",
        ).forEach { assertTrue(result.output.contains(it), "нет '$it' в выводе:\n${result.output}") }
    }

    @Test
    fun whatTheViewNormalizerSkippedIsPrinted() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            platform = "android-view",
        )

        assertTrue(result.output.contains("Skipped: 1 properties of type unknown"), result.output)
        assertTrue(result.output.contains("Skipped: 1 properties of sub-style records"), result.output)
        // Пропуски идут после отчёта и перед статусом.
        assertTrue(
            result.output.indexOf("Rejected:") < result.output.indexOf("Skipped:") &&
                result.output.indexOf("Skipped:") < result.output.indexOf("Status:"),
            result.output,
        )
    }

    @Test
    fun composeImportPrintsNoSkippedLines() {
        val result = run(listOf("components", "import-api", "--api-url", "http://backend"))

        assertTrue(!result.output.contains("Skipped:"), result.output)
    }

    @Test
    fun anEmptyViewMetaIsRefusedAndNothingIsSent() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            platform = "android-view",
            viewMeta = "{}",
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("classpath"), result.output)
        assertTrue(result.output.contains(VIEW_META_PATH), result.output)
        assertTrue(requests.isEmpty(), "пустой манифест отправлен")
    }

    @Test
    fun aMissingViewMetaFileNamesTheExpectedPath() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            platform = "android-view",
            viewMeta = null,
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains(VIEW_META_PATH), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aComposeMetaInAnAndroidViewProjectIsReportedWithTheFile() {
        val result = run(
            listOf("components", "import-api", "--api-url", "http://backend"),
            platform = "android-view",
            viewMeta = "[]",
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("not a View meta"), result.output)
        assertTrue(requests.isEmpty())
    }

    /**
     * Запускает CLI на проекте с указанной платформой.
     *
     * @param meta содержимое файла, который «пишет» задача Gradle; `null` — файл не появляется.
     */
    private fun run(
        args: List<String>,
        platform: String = "compose",
        meta: String? = META,
        gradleExitCode: Int = 0,
        report: String = REPORT,
        viewMeta: String? = VIEW_META,
    ) = cli(platform, meta, viewMeta, gradleExitCode, report).execute(args)

    private fun cli(
        platform: String,
        meta: String?,
        viewMeta: String?,
        gradleExitCode: Int,
        report: String,
    ): DsBuilderCli {
        val files = mutableMapOf(
            "/repo/.sdds/config.json" to config(platform),
            "/repo/gradlew" to "",
        )
        return DsBuilderCli(
            ClientRuntime(
                fileSystem = InMemoryFileSystem(files),
                environmentReader = EnvironmentReader { name ->
                    if (name == "DSBUILDER_API_KEY") "secret-key" else null
                },
                httpClientFactory = object : AuthenticatedHttpClientFactory {
                    override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient =
                        object : AuthenticatedHttpClient {
                            override suspend fun get(path: String): AuthenticatedHttpResult =
                                AuthenticatedHttpResult.Failure("unexpected GET $path")

                            override suspend fun post(path: String, body: String): AuthenticatedHttpResult {
                                requests += path to body
                                return AuthenticatedHttpResult.Success(report)
                            }
                        }
                },
                processRunner = ProcessRunner { request ->
                    processes += request
                    if ("readUikitComposeApiMeta" in request.args) {
                        if (meta != null && gradleExitCode == 0) files[META_PATH] = meta
                        ProcessResult(exitCode = gradleExitCode, output = "")
                    } else if ("readUikitApiMeta" in request.args) {
                        if (viewMeta != null && gradleExitCode == 0) files[VIEW_META_PATH] = viewMeta
                        ProcessResult(exitCode = gradleExitCode, output = "")
                    } else {
                        ProcessResult(exitCode = 0, output = "")
                    }
                },
            ),
        )
    }

    private fun config(platform: String) = """
        {
          "projectId": "project-a",
          "designSystemId": "ds-a",
          "credential": { "type": "env", "name": "DSBUILDER_API_KEY" },
          "platforms": ["$platform"]
        }
    """.trimIndent()

    private companion object {
        const val META_PATH = "/repo/build/theme-builder/components/uikit-compose-api-meta.json"
        const val VIEW_META_PATH = "/repo/build/theme-builder/components/uikit-api-meta.json"

        /** Мета View в форме вывода плагина: поля со значениями по умолчанию опущены. */
        const val VIEW_META = """
            {"components":[
              {"componentNames":["Avatar"],"styleableName":"Avatar","params":[
                {"id":"width","attrName":"android:minWidth","type":"dimension"},
                {"id":"label","attrName":"sd_label","type":"unknown"}],
               "stateSets":[{"name":"AvatarStatus","states":[{"configName":"active"}]}]},
              {"componentNames":["Avatar"],"styleableName":"AvatarBox","params":[
                {"id":"width","attrName":"android:maxWidth","type":"dimension"}]},
              {"componentNames":["Card"],"styleableName":"CardContent","subStyle":{"name":"Content","kind":"style"},
               "params":[{"id":"contentShape","attrName":"sd_contentShape","type":"shape"}]},
              {"componentNames":["Badge","IconBadge"],"styleableName":"Badge","params":[
                {"id":"size","attrName":"sd_size","type":"dimension"}]}]}
        """

        const val META = """
            [{"componentName":"Avatar","params":[
               {"id":"shape","type":"shape","group":"root","methodName":"shape","paramSimpleType":"Shape"},
               {"id":"size","type":"dimension","group":"dimensions","methodName":"size","paramSimpleType":"Dp"}],
              "stateEnum":{"values":[{"name":"Active"}]}},
             {"componentName":"Badge","params":[
               {"id":"size","type":"dimension","group":"dimensions"},
               {"id":"size","type":"dimension","group":"dimensionValues"}]}]
        """

        const val REPORT = """
            {"createdComponents":1,"createdProperties":3,"createdStates":1,"createdAliases":3,"createdLinks":2,
             "unchangedProperties":0,"rejected":[],"typeMismatches":[]}
        """

        const val REPORT_WITH_FINDINGS = """
            {"createdComponents":0,"createdProperties":0,"createdStates":0,"createdAliases":0,"createdLinks":0,
             "unchangedProperties":2,
             "rejected":[{"component":"Box","property":"odd","reason":"unknown property type: odd"}],
             "typeMismatches":["Box.size: db=float, meta=dimension"]}
        """
    }
}

/**
 * Файловая система в памяти: Gradle-процесс дописывает в неё файл меты.
 */
private class InMemoryFileSystem(private val files: MutableMap<String, String>) : WorkspaceFileSystem {
    override fun currentWorkingDirectory(): String = "/repo"

    override fun parent(path: String): String? = path.substringBeforeLast('/', "").takeIf { it.isNotEmpty() }

    override fun resolve(parent: String, child: String): String = "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String =
        if (path.startsWith("/")) path else "${currentWorkingDirectory()}/$path"

    override fun exists(path: String): Boolean = path in files

    override fun isDirectory(path: String): Boolean = false

    override fun createDirectories(path: String) = Unit

    override fun listFiles(path: String): List<String> = emptyList()

    override fun readText(path: String): String = files[path].orEmpty()

    override fun readBytes(path: String): ByteArray = files[path].orEmpty().encodeToByteArray()

    override fun writeText(path: String, text: String) {
        files[path] = text
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        files[path] = bytes.decodeToString()
    }

    override fun sink(path: String): BufferedSink = okio.Buffer()

    override fun deleteFile(path: String) {
        files.remove(path)
    }
}
