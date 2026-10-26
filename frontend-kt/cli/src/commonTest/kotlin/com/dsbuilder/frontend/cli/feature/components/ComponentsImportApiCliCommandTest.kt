package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.DsBuilderCli
import com.dsbuilder.frontend.core.application.ClientRuntime
import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Сквозные тесты `components import-api` через настоящий DI-граф CLI.
 *
 * Подменены только границы: файловая система (в памяти), хранилище user session, клиент токенов и
 * HTTP. Проекта, `.sdds/config.json` и процессов нет: команда читает файл меты и идёт к backend с
 * сессией администратора.
 */
class ComponentsImportApiCliCommandTest {
    private val requests = mutableListOf<Pair<String, String>>()
    private val credentials = mutableListOf<BackendCredential>()

    @Test
    fun dryRunReadsTheFileAndSendsOneRequestToTheAdminRoute() {
        val result = run(base())

        assertEquals(0, result.exitCode, result.output)
        assertEquals(1, requests.size, "запросов должно быть ровно один: $requests")
        val (path, body) = requests.single()
        assertEquals("/api/admin/component-config/import-api-meta", path)
        assertTrue(body.contains("\"dryRun\":true"), body)
        assertTrue(body.contains("\"platform\":\"compose\""), body)
        assertTrue(!body.contains("designSystemId"), body)
        assertTrue(body.contains("\"source\":\"uikit-compose-api-meta.json\""), body)
        assertTrue(result.output.contains("Status: dry run"), result.output)
        assertTrue(result.output.contains("Components: 2"), result.output)
        assertTrue(result.output.contains("Properties: 3"), result.output)
        assertTrue(result.output.contains("Created components: 1"), result.output)
    }

    @Test
    fun theCredentialIsTheUserSessionTokenNotTheProjectKeyFromTheEnvironment() {
        val result =
            run(base(), env = mapOf("DSBUILDER_API_KEY" to "secret-key", "DSBUILDER_API_URL" to "http://backend"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals(listOf<BackendCredential>(BackendCredential.Bearer("access-token")), credentials)
        assertTrue(!result.output.contains("secret-key"), result.output)
    }

    @Test
    fun applySendsTheRequestAsNonDryRun() {
        val result = run(base() + "--apply")

        assertEquals(0, result.exitCode, result.output)
        assertTrue(requests.single().second.contains("\"dryRun\":false"), requests.single().second)
        assertTrue(result.output.contains("Status: API meta imported"), result.output)
    }

    @Test
    fun printsTheTargetWithoutProjectOrDesignSystem() {
        val result = run(base())

        listOf(
            "Platform: compose",
            "Source: $META_PATH",
            "API URL: http://backend (from DSBUILDER_API_URL)",
        ).forEach { assertTrue(result.output.contains(it), "нет '$it' в выводе:\n${result.output}") }
        listOf("Project:", "Design system:", "Linked to the design system").forEach {
            assertTrue(!result.output.contains(it), "лишнее '$it' в выводе:\n${result.output}")
        }
    }

    @Test
    fun aRelativeFromPathIsResolvedAgainstTheWorkingDirectory() {
        val result =
            run(
                listOf(
                    "components",
                    "import-api",
                    "--from",
                    "uikit-compose-api-meta.json",
                    "--platform",
                    "compose",
                ),
                files = mapOf("/repo/uikit-compose-api-meta.json" to META),
            )

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Source: /repo/uikit-compose-api-meta.json"), result.output)
    }

    @Test
    fun printsRejectionsAndTypeMismatches() {
        val result = run(base(), report = REPORT_WITH_FINDINGS)

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Rejected: 1"), result.output)
        assertTrue(result.output.contains("Box.odd: unknown property type: odd"), result.output)
        assertTrue(result.output.contains("Property type mismatches"), result.output)
        assertTrue(result.output.contains("Box.size: db=float, meta=dimension"), result.output)
    }

    @Test
    fun strictFailsOnRejectedProperties() {
        val result = run(base() + "--strict", report = REPORT_WITH_FINDINGS)

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("Rejected: 1"), "отчёт не напечатан:\n${result.output}")
    }

    @Test
    fun strictPassesWhenNothingIsRejected() {
        assertEquals(0, run(base() + "--strict").exitCode)
    }

    @Test
    fun mapTypeIsAppliedToTheRequest() {
        run(base() + listOf("--map-type", "dimension:float"))

        val body = requests.single().second
        assertTrue(!body.contains("\"type\":\"dimension\""), body)
        assertTrue(body.contains("\"type\":\"float\""), body)
    }

    @Test
    fun malformedMapTypeIsRejectedBeforeAnythingIsSent() {
        val result = run(base() + listOf("--map-type", "dimension"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("from:to"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun applyAndDryRunTogetherAreRejectedBeforeAnythingIsSent() {
        val result = run(base() + listOf("--apply", "--dry-run"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun fromAndPlatformAreRequired() {
        val withoutFrom =
            run(listOf("components", "import-api", "--platform", "compose"))
        val withoutPlatform =
            run(listOf("components", "import-api", "--from", META_PATH))

        assertEquals(1, withoutFrom.exitCode, withoutFrom.output)
        assertTrue(withoutFrom.output.contains("--from"), withoutFrom.output)
        assertEquals(1, withoutPlatform.exitCode, withoutPlatform.output)
        assertTrue(withoutPlatform.output.contains("--platform"), withoutPlatform.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun theGradleToolAndTheApiKeyOptionsAreGone() {
        val tool = run(base() + listOf("--tool", "gradle"))
        val key = run(base() + listOf("--api-key", "secret-key"))

        assertEquals(1, tool.exitCode, tool.output)
        assertTrue(tool.output.contains("--tool"), tool.output)
        assertEquals(1, key.exitCode, key.output)
        assertTrue(key.output.contains("--api-key"), key.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun withoutAnExplicitApiUrlNothingIsSent() {
        val result =
            run(listOf("components", "import-api", "--from", META_PATH, "--platform", "compose"), env = emptyMap())

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("DSBUILDER_API_URL"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun anUnknownPlatformIsRefusedBeforeAnythingIsSent() {
        // Все платформы TargetPlatform поддержаны, поэтому отказ проверяется на значении вне словаря.
        val result = run(base(platform = "flutter"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("flutter"), result.output)
        assertTrue(result.output.contains("compose, android-view, swiftui, react"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aMissingFileNamesThePath() {
        val result = run(base(), files = emptyMap())

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains(META_PATH), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun anEmptyMetaIsRefusedAndNothingIsSent() {
        val result = run(base(), files = mapOf(META_PATH to "[]"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains(META_PATH), result.output)
        assertTrue(requests.isEmpty(), "пустой манифест отправлен")
    }

    @Test
    fun withoutAUserSessionTheMessageSaysHowToLogIn() {
        val result = run(base(), session = false)

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("DSBUILDER_API_URL=http://backend dsbuilder auth login"), result.output)
        assertTrue(result.output.contains("system administrator"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aForbiddenAnswerShowsTheReasonOfTheServer() {
        val result = run(
            base(),
            answer = AuthenticatedHttpResult.Failure(
                "Credential has no access to this project. Server: System administrator role is required",
            ),
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("System administrator role is required"), result.output)
    }

    @Test
    fun anAndroidViewMetaGoesWithTheXmlPlatform() {
        val result =
            run(base(platform = "android-view", from = VIEW_META_PATH), files = mapOf(VIEW_META_PATH to VIEW_META))

        assertEquals(0, result.exitCode, result.output)
        val (path, body) = requests.single()
        assertEquals("/api/admin/component-config/import-api-meta", path)
        assertTrue(body.contains("\"platform\":\"xml\""), body)
        assertTrue(
            body.contains("\"platformNames\":[{\"name\":\"android:minWidth\"},{\"name\":\"android:maxWidth\"}]"),
            body,
        )
        assertTrue(body.contains("\"states\":[\"active\"]"), body)
        listOf("Platform: android-view", "Source: $VIEW_META_PATH", "Components: 3", "Properties: 3", "States: 1")
            .forEach { assertTrue(result.output.contains(it), "нет '$it' в выводе:\n${result.output}") }
    }

    @Test
    fun aSwiftUiMetaGoesWithTheIosPlatform() {
        val result =
            run(base(platform = "swiftui", from = IOS_META_PATH), files = mapOf(IOS_META_PATH to IOS_META))

        assertEquals(0, result.exitCode, result.output)
        val (path, body) = requests.single()
        assertEquals("/api/admin/component-config/import-api-meta", path)
        assertTrue(body.contains("\"platform\":\"ios\""), body)
        assertTrue(
            body.contains(
                "\"platformNames\":[{\"name\":\"toggleColorChecked\"},{\"name\":\"toggleColorIndeterminate\"}]",
            ),
            body,
        )
        assertTrue(body.contains("\"states\":[\"checked\"]"), body)
        listOf("Platform: swiftui", "Source: $IOS_META_PATH", "Components: 1", "Properties: 1", "States: 1")
            .forEach { assertTrue(result.output.contains(it), "нет '$it' в выводе:\n${result.output}") }
    }

    @Test
    fun whatTheSwiftUiNormalizerSkippedIsPrinted() {
        val result =
            run(base(platform = "swiftui", from = IOS_META_PATH), files = mapOf(IOS_META_PATH to IOS_META))

        assertTrue(result.output.contains("Skipped: 1 properties without platform code"), result.output)
    }

    @Test
    fun whatTheViewNormalizerSkippedIsPrintedBetweenTheReportAndTheStatus() {
        val result =
            run(base(platform = "android-view", from = VIEW_META_PATH), files = mapOf(VIEW_META_PATH to VIEW_META))

        assertTrue(result.output.contains("Skipped: 1 properties of type unknown"), result.output)
        assertTrue(result.output.contains("Skipped: 1 properties of sub-style records"), result.output)
        assertTrue(
            result.output.indexOf("Rejected:") < result.output.indexOf("Skipped:") &&
                result.output.indexOf("Skipped:") < result.output.indexOf("Status:"),
            result.output,
        )
    }

    @Test
    fun composeImportPrintsNoSkippedLines() {
        assertTrue(!run(base()).output.contains("Skipped:"))
    }

    @Test
    fun aComposeMetaGivenAsAndroidViewIsReportedWithTheFile() {
        val result = run(base(platform = "android-view"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("not a View meta"), result.output)
        assertTrue(result.output.contains(META_PATH), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aWebMetaGoesWithTheWebPlatform() {
        val result = run(base(platform = "react", from = WEB_META_PATH), files = mapOf(WEB_META_PATH to WEB_META))

        assertEquals(0, result.exitCode, result.output)
        val (path, body) = requests.single()
        assertEquals("/api/admin/component-config/import-api-meta", path)
        assertTrue(body.contains("\"platform\":\"web\""), body)
        assertTrue(body.contains("\"source\":\"web-api-meta.json\""), body)
        // Токен состояния `buttonColorHover` платформенным именем не становится.
        assertTrue(body.contains("\"platformNames\":[{\"name\":\"buttonColor\"}]"), body)
        assertTrue(
            body.contains("\"platformNames\":[{\"name\":\"buttonFontFamily\"},{\"name\":\"buttonFontSize\"}]"),
            body,
        )
        // `hovered` — состояние взаимодействия, а не компонента.
        assertTrue(body.contains("\"states\":[]"), body)
        // `AvatarGroup` без токенов уходит компонентом без свойств.
        assertTrue(body.contains("{\"name\":\"AvatarGroup\",\"properties\":[],\"states\":[]}"), body)
        listOf("Platform: react", "Source: $WEB_META_PATH", "Components: 2", "Properties: 2", "States: 0")
            .forEach { assertTrue(result.output.contains(it), "нет '$it' в выводе:\n${result.output}") }
    }

    @Test
    fun aComposeMetaGivenAsReactIsReportedWithTheFile() {
        val result = run(base(platform = "react"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("not a list of web components"), result.output)
        assertTrue(result.output.contains(META_PATH), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun printsDeprecationCountersOnlyWhenTheyAreNotZero() {
        val quiet = run(base())
        val busy = run(
            base(),
            report = """{"createdComponents":0,"createdProperties":0,"createdStates":0,"createdAliases":0,
                "unchangedProperties":3,"deprecatedMarked":2,"deprecatedMessageChanged":1,"deprecatedCleared":4,
                "rejected":[],"typeMismatches":[]}""",
        )

        assertTrue(!quiet.output.contains("Deprecated"), quiet.output)
        listOf("Deprecated marked: 2", "Deprecated message changed: 1", "Deprecated cleared: 4")
            .forEach { assertTrue(busy.output.contains(it), "нет '$it' в выводе:\n${busy.output}") }
    }

    @Test
    fun printsTheAbsentListAsInformationAndItNeverFailsStrict() {
        val result = run(
            base() + "--strict",
            report = """{"createdComponents":0,"createdProperties":0,"createdStates":0,"createdAliases":0,
                "unchangedProperties":3,"rejected":[],"typeMismatches":[],"absent":["Box","Avatar.size"]}""",
        )

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Absent from meta (informational, nothing was removed): 2"), result.output)
        assertTrue(result.output.contains("  Box") && result.output.contains("  Avatar.size"), result.output)
    }

    @Test
    fun noAbsentSectionWhenNothingIsAbsent() {
        assertTrue(!run(base()).output.contains("Absent from meta"))
    }

    @Test
    fun aDeprecatedPropertyInTheMetaReachesTheRequest() {
        val meta = """[{"componentName":"Box","params":[
            {"id":"color","type":"color","deprecated":{"message":"Use X"}},
            {"id":"size","type":"dimension"}]}]"""

        run(base(), files = mapOf(META_PATH to meta))

        val body = requests.single().second
        assertTrue(body.contains("{\"name\":\"color\",\"deprecated\":{\"message\":\"Use X\"}}"), body)
        assertTrue(body.contains("\"platformNames\":[{\"name\":\"size\"}]"), body)
    }

    private fun base(platform: String = "compose", from: String = META_PATH) = listOf(
        "components",
        "import-api",
        "--from",
        from,
        "--platform",
        platform,
    )

    private fun run(
        args: List<String>,
        files: Map<String, String> = mapOf(META_PATH to META),
        env: Map<String, String> = mapOf("DSBUILDER_API_URL" to "http://backend"),
        session: Boolean = true,
        report: String = REPORT,
        answer: AuthenticatedHttpResult = AuthenticatedHttpResult.Success(report),
    ) = DsBuilderCli(
        ClientRuntime(
            fileSystem = InMemoryFileSystem(files.toMutableMap()),
            environmentReader = EnvironmentReader { name -> env[name] },
            httpClientFactory = FakeHttpClientFactory(answer, requests, credentials),
            credentialStore = sessionStore(session),
            tokenClient = tokenClient(),
        ),
    ).execute(args)

    private fun sessionStore(present: Boolean): CredentialStore = object : CredentialStore {
        override suspend fun read(apiUrl: String): UserSession? = UserSession(
            schemaVersion = 2,
            apiUrl = apiUrl,
            username = "admin@example.com",
            refreshToken = "refresh-token",
            refreshExpiresAt = 999,
            updatedAt = 1,
        ).takeIf { present }

        override suspend fun save(session: UserSession) = Unit

        override suspend fun delete(apiUrl: String) = Unit
    }

    private fun tokenClient(): TokenClient = object : TokenClient {
        override suspend fun exchangeCode(
            apiUrl: String,
            code: String,
            verifier: String,
            redirectUri: String,
        ): AuthResult<TokenResponse> =
            AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")

        override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
            AuthResult.Success(TokenResponse("access-token", "refresh-token", 999))

        override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> =
            AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")
    }

    private companion object {
        const val META_PATH = "/work/meta/uikit-compose-api-meta.json"
        const val VIEW_META_PATH = "/work/meta/uikit-api-meta.json"
        const val IOS_META_PATH = "/work/meta/ios-api-meta.json"

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

        const val WEB_META_PATH = "/work/meta/web-api-meta.json"

        /** Мета web в форме вывода `generate:api-meta`: запись — токен. */
        const val WEB_META = """
            [{"componentName":"AvatarGroup","params":[]},
             {"componentName":"Button","params":[
               {"paramName":"buttonColor","type":"color","id":"labelColor"},
               {"paramName":"buttonColorHover","type":"color","id":"labelColor","state":"hovered"},
               {"paramName":"buttonFontFamily","type":"typography","id":"labelStyle","part":"fontFamily"},
               {"paramName":"buttonFontSize","type":"typography","id":"labelStyle","part":"fontSize"}]}]
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

        /** Мета iOS: повтор `id` с разными именами в коде и параметр без кода на платформе. */
        const val IOS_META = """
            [{"componentName":"CheckBox","params":[
               {"id":"toggleIconWidth","type":"dimension","group":"root","methodName":"","unmapped":true},
               {"id":"toggleIconColor","type":"color","group":"root","methodName":"toggleColorChecked",
                "paramSimpleType":"StatefulFillStyle"},
               {"id":"toggleIconColor","type":"color","group":"root","methodName":"toggleColorIndeterminate",
                "paramSimpleType":"StatefulFillStyle"}],
              "stateEnum":{"values":[{"name":"checked","configName":"checked"}]}}]
        """

        const val REPORT = """
            {"createdComponents":1,"createdProperties":3,"createdStates":1,"createdAliases":3,
             "unchangedProperties":0,"rejected":[],"typeMismatches":[]}
        """

        const val REPORT_WITH_FINDINGS = """
            {"createdComponents":0,"createdProperties":0,"createdStates":0,"createdAliases":0,
             "unchangedProperties":2,
             "rejected":[{"component":"Box","property":"odd","reason":"unknown property type: odd"}],
             "typeMismatches":["Box.size: db=float, meta=dimension"]}
        """
    }
}

private class FakeHttpClientFactory(
    private val answer: AuthenticatedHttpResult,
    private val requests: MutableList<Pair<String, String>>,
    private val credentials: MutableList<BackendCredential>,
) : AuthenticatedHttpClientFactory {
    override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient = client()

    override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient {
        credentials += credential
        return client()
    }

    private fun client() = object : AuthenticatedHttpClient {
        override suspend fun get(path: String): AuthenticatedHttpResult =
            AuthenticatedHttpResult.Failure("unexpected GET $path")

        override suspend fun post(path: String, body: String): AuthenticatedHttpResult {
            requests += path to body
            return answer
        }
    }
}

/** Файловая система в памяти с файлом меты, который администратор указывает в `--from`. */
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
