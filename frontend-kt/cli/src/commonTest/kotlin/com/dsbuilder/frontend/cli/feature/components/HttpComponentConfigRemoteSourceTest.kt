package com.dsbuilder.frontend.cli.feature.components

import com.dsbuilder.frontend.cli.core.domain.DesignSystemId
import com.dsbuilder.frontend.cli.core.domain.ProjectApiKey
import com.dsbuilder.frontend.cli.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.cli.core.domain.ProjectId
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClient
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpResult
import com.dsbuilder.frontend.cli.feature.components.application.ImportComponentsCommand
import com.dsbuilder.frontend.cli.feature.components.application.ImportComponentsResult
import com.dsbuilder.frontend.cli.feature.components.data.HttpComponentConfigRemoteSource
import com.dsbuilder.frontend.cli.feature.components.domain.ConvertedComponentConfig
import com.dsbuilder.frontend.cli.feature.components.domain.codec.CommonConfig
import com.dsbuilder.frontend.cli.feature.components.domain.codec.ConfigCodec
import com.dsbuilder.frontend.cli.feature.components.domain.codec.ConfigCodecResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class HttpComponentConfigRemoteSourceTest {
    @Test
    fun sendsSinglePostWithWholePackage() {
        val requests = mutableListOf<Pair<String, String>>()
        val paths = mutableListOf<String>()
        val result = import(
            onGet = { paths += it },
            onPost = { path, body ->
                paths += path
                requests += path to body
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        assertTrue(result is ImportComponentsResult.Imported, "импорт отказал: $result")
        assertEquals(1, paths.size, "выполнены лишние запросы: $paths")
        assertEquals("/api/projects/project-a/ds/component-config/import", requests.single().first)

        val parsed = Json.parseToJsonElement(requests.single().second).jsonObject
        assertEquals("ds-a", parsed.getValue("designSystemId").jsonPrimitive.content)
        val meta = parsed.getValue("meta").jsonObject
        assertEquals("sdds_sbcom", meta.getValue("name").jsonPrimitive.content)
        assertEquals("/work/.sdds/components", meta.getValue("source").jsonPrimitive.content)
        assertEquals(2, parsed.getValue("components").jsonArray.size)
    }

    @Test
    fun bodyCarriesCommonFormatWithPropertiesKey() {
        var body = ""
        import(
            onPost = { _, requestBody ->
                body = requestBody
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        val component = Json.parseToJsonElement(body).jsonObject
            .getValue("components").jsonArray[1].jsonObject

        assertEquals("badge", component.getValue("componentName").jsonPrimitive.content)
        assertEquals("badge-solid", component.getValue("styleName").jsonPrimitive.content)
        val values = component.getValue("config").jsonObject
            .getValue("variations").jsonArray[0].jsonObject
            .getValue("values").jsonArray[0].jsonObject
        assertTrue(values.containsKey("properties"), "свойства значения не под ключом properties")
        assertTrue(!values.containsKey("props"), "свойства значения сериализованы под ключом props")
    }

    @Test
    fun dryRunIsMarkedInRequest() {
        var body = ""
        import(
            dryRun = true,
            onPost = { _, requestBody ->
                body = requestBody
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        val sent = Json.parseToJsonElement(body).jsonObject.getValue("dryRun").jsonPrimitive.content
        assertEquals(true, sent.toBoolean())
    }

    @Test
    fun applyIsMarkedInRequest() {
        var body = ""
        import(
            dryRun = false,
            onPost = { _, requestBody ->
                body = requestBody
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        val sent = Json.parseToJsonElement(body).jsonObject.getValue("dryRun").jsonPrimitive.content
        assertEquals(false, sent.toBoolean())
    }

    @Test
    fun parsesImportReport() {
        val result = import(onPost = { _, _ -> AuthenticatedHttpResult.Success(REPORT) })

        val report = assertNotNull(result as? ImportComponentsResult.Imported).report
        assertEquals(1, report.created)
        assertEquals(2, report.updated)
        assertEquals(3, report.unchanged)
        assertEquals(1, report.rejected.size)
        assertEquals("badge", report.rejected.single().componentName)
        assertEquals("badge-clear", report.rejected.single().styleName)
        assertEquals("unknown property type", report.rejected.single().reason)
    }

    @Test
    fun parsesDivergenceSectionsOfReport() {
        val result = import(onPost = { _, _ -> AuthenticatedHttpResult.Success(REPORT_WITH_DIVERGENCES) })

        val report = assertNotNull(result as? ImportComponentsResult.Imported).report
        assertEquals(listOf("badge.labelColor"), report.unknownProperties)
        assertEquals(listOf("hovered"), report.unknownStates)
        assertEquals(listOf("badge.shape"), report.typeMismatches)
    }

    @Test
    fun unreadableSuccessBodyIsRejected() {
        val result = import(onPost = { _, _ -> AuthenticatedHttpResult.Success("not a report") })

        val failed = assertNotNull(result as? ImportComponentsResult.Failed)
        assertTrue(failed.message.contains("unreadable import report"), failed.message)
    }

    @Test
    fun backendFailureKeepsCoreMessage() {
        val result = import(
            onPost = { _, _ ->
                AuthenticatedHttpResult.Failure("Status: forbidden. API key has no access to this project.")
            },
        )

        val failed = assertNotNull(result as? ImportComponentsResult.Failed)
        assertEquals("Status: forbidden. API key has no access to this project.", failed.message)
    }

    @Test
    fun usesResolvedApiUrlAndApiKey() {
        var seenApiUrl = ""
        var seenApiKey = ""
        import(
            onCreate = { apiUrl, apiKey ->
                seenApiUrl = apiUrl
                seenApiKey = apiKey
            },
            onPost = { _, _ -> AuthenticatedHttpResult.Success(REPORT) },
        )

        assertEquals("http://localhost:8080", seenApiUrl)
        assertEquals("secret-key", seenApiKey)
    }

    private fun import(
        dryRun: Boolean = true,
        components: List<ConvertedComponentConfig> = defaultComponents,
        onCreate: (String, String) -> Unit = { _, _ -> },
        onGet: (String) -> Unit = {},
        onPost: (String, String) -> AuthenticatedHttpResult,
    ): ImportComponentsResult =
        HttpComponentConfigRemoteSource(FakeHttpClientFactory(onCreate, onGet, onPost)).import(
            ImportComponentsCommand(
                apiUrl = ProjectApiUrl("http://localhost:8080"),
                apiKey = ProjectApiKey("secret-key"),
                projectId = ProjectId("project-a"),
                designSystemId = DesignSystemId("ds-a"),
                packageName = "sdds_sbcom",
                packageOrigin = "/work/.sdds/components",
                dryRun = dryRun,
                components = components,
            ),
        )

    private val defaultComponents = listOf(
        converted("badge", "badge-clear", NativeConfigCorpus.plasmaStardsDivider),
        converted("badge", "badge-solid", NativeConfigCorpus.plasmaB2cAvatarGroup),
    )

    private companion object {
        const val REPORT = """
            {"created":1,"updated":2,"unchanged":3,
             "rejected":[{"componentName":"badge","styleName":"badge-clear","reason":"unknown property type"}]}
        """

        const val REPORT_WITH_DIVERGENCES = """
            {"created":1,"updated":0,"unchanged":0,"rejected":[],
             "unknownProperties":["badge.labelColor"],
             "unknownStates":["hovered"],
             "typeMismatches":["badge.shape"]}
        """

        fun converted(
            componentName: String,
            styleName: String,
            nativeConfig: String,
        ): ConvertedComponentConfig = ConvertedComponentConfig(
            componentName = componentName,
            styleName = styleName,
            config = decode(nativeConfig),
        )

        fun decode(nativeConfig: String): CommonConfig =
            when (val result = ConfigCodec().decode(nativeConfig)) {
                is ConfigCodecResult.Success -> result.value
                is ConfigCodecResult.Failure -> error("корпус тестов не декодируется: ${result.reason.message}")
            }
    }
}

private class FakeHttpClientFactory(
    private val onCreate: (String, String) -> Unit,
    private val onGet: (String) -> Unit,
    private val onPost: (String, String) -> AuthenticatedHttpResult,
) : AuthenticatedHttpClientFactory {
    override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient {
        onCreate(apiUrl, apiKey)
        return object : AuthenticatedHttpClient {
            override fun get(path: String): AuthenticatedHttpResult {
                onGet(path)
                return AuthenticatedHttpResult.Failure("Status: not found. Project or resource was not found.")
            }

            override fun post(path: String, body: String): AuthenticatedHttpResult = onPost(path, body)
        }
    }
}
