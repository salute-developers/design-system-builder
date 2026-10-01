package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaRemoteCommand
import com.dsbuilder.frontend.feature.components.application.ImportApiMetaRemoteResult
import com.dsbuilder.frontend.feature.components.data.HttpApiMetaRemoteSource
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaComponent
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaManifest
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaProperty
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class HttpApiMetaRemoteSourceTest {
    @Test
    fun sendsOneRequestWithTheWholeManifestToTheImportApiMetaPath() = runTest {
        val posts = mutableListOf<Pair<String, String>>()
        var gets = 0

        val result = import(
            onGet = { gets += 1 },
            onPost = { path, body ->
                posts += path to body
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        assertIs<ImportApiMetaRemoteResult.Imported>(result)
        assertEquals(0, gets)
        assertEquals(1, posts.size, "выполнены лишние запросы: $posts")
        assertEquals("/api/projects/project-a/ds/component-config/import-api-meta", posts.single().first)

        val body = Json.parseToJsonElement(posts.single().second).jsonObject
        assertEquals("ds-a", body.getValue("designSystemId").jsonPrimitive.content)
        assertEquals("compose", body.getValue("platform").jsonPrimitive.content)
        assertEquals(
            "/work/uikit-compose-api-meta.json",
            body.getValue("meta").jsonObject
                .getValue("source").jsonPrimitive.content,
        )
        assertEquals(3, body.getValue("components").jsonArray.size)
    }

    @Test
    fun theRequestPathHasNeitherTheDesignSystemNorACustomMethod() = runTest {
        var path = ""
        import(
            onPost = { requestPath, _ ->
                path = requestPath
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        assertTrue(!path.contains("ds-a"), path)
        assertTrue(!path.contains(":"), path)
    }

    @Test
    fun theBodyCarriesPropertiesAndStatesOfEveryComponent() = runTest {
        var body = ""
        import(
            onPost = { _, requestBody ->
                body = requestBody
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        val avatar = Json.parseToJsonElement(body).jsonObject.getValue("components").jsonArray[0].jsonObject
        assertEquals("Avatar", avatar.getValue("name").jsonPrimitive.content)
        assertEquals(listOf("none", "active"), avatar.getValue("states").jsonArray.map { it.jsonPrimitive.content })
        val property = avatar.getValue("properties").jsonArray[0].jsonObject
        assertEquals("shape", property.getValue("name").jsonPrimitive.content)
        assertEquals("shape", property.getValue("type").jsonPrimitive.content)
        assertEquals(listOf("shape"), property.getValue("platformNames").jsonArray.map { it.jsonPrimitive.content })
        assertTrue(!property.containsKey("platformName"), "прежнее поле platformName отправлено")
        assertEquals("method: shape", property.getValue("description").jsonPrimitive.content)
    }

    @Test
    fun severalPlatformNamesAreSentAsAList() = runTest {
        var body = ""
        import(
            onPost = { _, requestBody ->
                body = requestBody
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        val slider = Json.parseToJsonElement(body).jsonObject.getValue("components").jsonArray[1].jsonObject
        val width = slider.getValue("properties").jsonArray[0].jsonObject
        assertEquals(
            listOf("android:minWidth", "android:maxWidth"),
            width.getValue("platformNames").jsonArray.map { it.jsonPrimitive.content },
        )
    }

    @Test
    fun aPropertyWithoutDescriptionOmitsTheField() = runTest {
        var body = ""
        import(
            onPost = { _, requestBody ->
                body = requestBody
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        val third = Json.parseToJsonElement(body).jsonObject.getValue("components").jsonArray[2].jsonObject
        val property = third.getValue("properties").jsonArray[0].jsonObject
        assertTrue(!property.containsKey("description") || property["description"] == JsonNull)
    }

    @Test
    fun dryRunIsMarkedInTheRequest() = runTest {
        val bodies = mutableListOf<String>()
        import(
            dryRun = true,
            onPost = { _, body ->
                bodies += body
                AuthenticatedHttpResult.Success(REPORT)
            },
        )
        import(
            dryRun = false,
            onPost = { _, body ->
                bodies += body
                AuthenticatedHttpResult.Success(REPORT)
            },
        )

        assertEquals(
            listOf(true, false),
            bodies.map { Json.parseToJsonElement(it).jsonObject.getValue("dryRun").jsonPrimitive.content.toBoolean() },
        )
    }

    @Test
    fun parsesTheReport() = runTest {
        val result = import(onPost = { _, _ -> AuthenticatedHttpResult.Success(REPORT) })

        val report = assertIs<ImportApiMetaRemoteResult.Imported>(result).report
        assertEquals(1, report.createdComponents)
        assertEquals(2, report.createdProperties)
        assertEquals(3, report.createdStates)
        assertEquals(4, report.createdAliases)
        assertEquals(5, report.createdLinks)
        assertEquals(6, report.unchangedProperties)
        assertEquals("Box", report.rejected.single().component)
        assertEquals("odd", report.rejected.single().property)
        assertEquals("unknown property type: odd", report.rejected.single().reason)
        assertEquals(listOf("Box.size: db=float, meta=dimension"), report.typeMismatches)
    }

    @Test
    fun missingReportFieldsDefaultToZero() = runTest {
        val result = import(onPost = { _, _ -> AuthenticatedHttpResult.Success("{}") })

        val report = assertIs<ImportApiMetaRemoteResult.Imported>(result).report
        assertEquals(0, report.createdComponents)
        assertEquals(emptyList(), report.rejected)
    }

    @Test
    fun anUnreadableReportFailsWithoutAPartialReport() = runTest {
        val result = import(onPost = { _, _ -> AuthenticatedHttpResult.Success("""{"createdComponents":"many"}""") })

        val failed = assertIs<ImportApiMetaRemoteResult.Failed>(result)
        assertTrue(failed.message.contains("unreadable API meta import report"), failed.message)
    }

    @Test
    fun aBackendFailureIsMappedWithoutTheKey() = runTest {
        val result = import(onPost = { _, _ -> AuthenticatedHttpResult.Failure("Status: forbidden.") })

        val failed = assertIs<ImportApiMetaRemoteResult.Failed>(result)
        assertEquals("Status: forbidden.", failed.message)
        assertTrue(!failed.message.contains("secret-key"))
    }

    private suspend fun import(
        dryRun: Boolean = true,
        onGet: (String) -> Unit = {},
        onPost: (String, String) -> AuthenticatedHttpResult,
    ): ImportApiMetaRemoteResult =
        HttpApiMetaRemoteSource(ApiMetaFakeHttpClientFactory(onGet, onPost)).import(
            ImportApiMetaRemoteCommand(
                apiUrl = ProjectApiUrl("http://localhost:8080"),
                credential = BackendCredential.ProjectKey("secret-key"),
                projectId = ProjectId("project-a"),
                designSystemId = DesignSystemId("ds-a"),
                platform = "compose",
                source = "/work/uikit-compose-api-meta.json",
                dryRun = dryRun,
                manifest = MANIFEST,
            ),
        )

    private companion object {
        val MANIFEST = ApiMetaManifest(
            listOf(
                ApiMetaComponent(
                    name = "Avatar",
                    properties = listOf(ApiMetaProperty("shape", "shape", listOf("shape"), "method: shape")),
                    states = listOf("none", "active"),
                ),
                ApiMetaComponent(
                    name = "Slider",
                    properties = listOf(
                        ApiMetaProperty(
                            "width",
                            "dimension",
                            listOf("android:minWidth", "android:maxWidth"),
                            "attr: android:minWidth/android:maxWidth",
                        ),
                    ),
                    states = emptyList(),
                ),
                ApiMetaComponent(
                    name = "Bare",
                    properties = listOf(ApiMetaProperty("flag", "boolean", listOf("flag"), null)),
                    states = emptyList(),
                ),
            ),
        )

        const val REPORT = """
            {"createdComponents":1,"createdProperties":2,"createdStates":3,"createdAliases":4,
             "createdLinks":5,"unchangedProperties":6,
             "rejected":[{"component":"Box","property":"odd","reason":"unknown property type: odd"}],
             "typeMismatches":["Box.size: db=float, meta=dimension"]}
        """
    }
}

private class ApiMetaFakeHttpClientFactory(
    private val onGet: (String) -> Unit,
    private val onPost: (String, String) -> AuthenticatedHttpResult,
) : AuthenticatedHttpClientFactory {
    override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
        override suspend fun get(path: String): AuthenticatedHttpResult {
            onGet(path)
            return AuthenticatedHttpResult.Failure("Status: not found.")
        }

        override suspend fun post(path: String, body: String): AuthenticatedHttpResult = onPost(path, body)
    }
}
