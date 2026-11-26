package com.dsbuilder.frontend.plugin.androidstudio.components

import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.feature.auth.application.RefreshUserSessionUseCase
import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import com.dsbuilder.frontend.plugin.androidstudio.preview.AssemblyResult
import com.dsbuilder.frontend.plugin.androidstudio.preview.PayloadAssembler
import com.dsbuilder.frontend.plugin.androidstudio.preview.PreviewAssemblyException
import com.dsbuilder.frontend.plugin.androidstudio.preview.obj
import com.dsbuilder.frontend.plugin.androidstudio.preview.text
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull

private fun apiFor(http: HttpClient): AuthenticatedApiClient {
    val store = object : RefreshTokenStore {
        override fun save(refreshToken: String) = Unit
        override fun load(): String? = null
        override fun clear() = Unit
    }
    val session = UserSessionCredentialResolver(store)
    session.applyTokens(UserOAuthTokens("test-access", "test-refresh", 300))
    val exchange = object : TokenExchangeClient {
        override suspend fun exchangeAuthorizationCode(
            code: String,
            codeVerifier: String,
            redirectUri: String,
            clientId: String,
        ): TokenExchangeResult = error("Unexpected login")
        override suspend fun refresh(
            refreshToken: String,
            clientId: String,
        ): TokenExchangeResult = error("Unexpected refresh")
    }
    return AuthenticatedApiClient(
        http,
        "https://api.example",
        session,
        RefreshUserSessionUseCase(
            exchange,
            session,
            "test",
        ),
    )
}

class ComponentCatalogTest {
    private val context = ComponentContext("project", "system", "tenant")

    @Test
    fun acceptsScopedSummaryWithoutPlatformAndRejectsExplicitOtherPlatforms() = runBlocking {
        val cursors = mutableListOf<String?>()
        val http = HttpClient(
            MockEngine { request ->
                assertEquals(HttpMethod.Get, request.method)
                assertEquals("Bearer test-access", request.headers[HttpHeaders.Authorization])
                assertEquals(
                    "/api/projects/project/design-systems/system/components",
                    request.url.encodedPath,
                )
                assertEquals("compose", request.url.parameters["platform"])
                val cursor = request.url.parameters["cursor"]
                cursors.add(cursor)
                if (cursor == null) {
                    respond(
                        """
[
  {
    "id": "a",
    "name": "BasicButton"
  }
]
""",
                        headers = headersOf("X-DS-Next-Cursor", "next"),
                    )
                } else {
                    respond(
                        """
[
  {
    "id": "b",
    "name": "Divider",
    "platform": "compose"
  },
  {
    "id": "web",
    "name": "Web",
    "platform": "web"
  }
]
""",
                    )
                }
            },
        )
        http.use {
            assertEquals(
                listOf(
                    "a",
                    "b",
                ),
                ComponentCatalog(apiFor(it)).list(context).map { component -> component.id },
            )
            assertEquals(listOf(null, "next"), cursors)
        }
    }

    private fun bundle(id: String, name: String, style: String, properties: String): String = """
        {"component":{"id":"$id","name":"$name","platform":"compose"},
         "export":{"components":[{"componentName":"$name","styleName":"$style","config":{
            "invariants":$properties,"defaults":[],"variations":[]}}]},
         "properties":[{"id":"style","name":"buttonStyle"},{"id":"height","name":"height"}],
         "platformParams":[{"propertyId":"style","platform":"compose","name":"buttonStyle"},
                           {"propertyId":"height","platform":"compose","name":"height"}]}
    """.trimIndent()

    @Test
    fun buildsNestedStyleFromHttpResponsesAndCachesTheTargetConfiguration() = runBlocking {
        val counts = mutableMapOf<String, Int>()
        val http = HttpClient(
            MockEngine { request ->
                assertEquals(HttpMethod.Get, request.method)
                val path = request.url.encodedPath
                counts[path] = (counts[path] ?: 0) + 1
                val content = when {
                    path.endsWith("/a/editor-bundle") -> bundle(
                        "a",
                        "ButtonGroup",
                        "button-group",
                        """
{
  "buttonStyle": {
    "type": "component_style",
    "value": "basic-button"
  }
}
""",
                    )
                    path.endsWith("/b/editor-bundle") -> bundle(
                        "b",
                        "BasicButton",
                        "basic-button",
                        """
{
  "height": {
    "type": "dimension",
    "value": 24
  }
}
""",
                    )
                    path.endsWith("/token-values") -> {
                        assertEquals("android", request.url.parameters["platforms"])
                        assertEquals(
                            "/api/projects/project/design-systems/system/tenants/tenant/token-values",
                            path,
                        )
                        "[]"
                    }
                    path.endsWith("/tokens") -> "[]"
                    path.endsWith("/appearances") ->
                        """
[
  {
    "name": "button-group",
    "componentId": "a"
  },
  {
    "name": "basic-button",
    "componentId": "b"
  }
]
"""
                    else -> error("Unexpected request: $path")
                }
                respond(content)
            },
        )
        http.use {
            val catalog = ComponentCatalog(apiFor(it))
            val components = listOf(
                CatalogComponent(
                    "a",
                    "ButtonGroup",
                ),
                CatalogComponent(
                    "b",
                    "BasicButton",
                ),
            )
            val loader = ComponentDraftLoader(catalog, context, this@runBlocking, components)
            val group = loader.bundle(components.first())
            repeat(2) {
                val draft = loader.draft(
                    group,
                    group.configurations.single(),
                    emptyMap(),
                    "light",
                    "ButtonGroup",
                )
                val payload = assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(draft)).payload
                assertEquals(
                    "BasicButton",
                    payload.obj("styles").obj("basic-button").text("component"),
                )
                val pairs = ApiJson.parseToJsonElement(
                    requireNotNull(javaClass.getResource("/preview/assembler-golden.json")).readText(),
                ) as kotlinx.serialization.json.JsonArray
                val expected = pairs.map { pair -> pair as JsonObject }.single { pair ->
                    pair.text("name") == "httpNested"
                }
                val expectedPayload = expected.obj("payload")
                assertEquals("#F9F9F9FF", payload.obj("surface").text("background"))
                assertEquals(expectedPayload.obj("surface") - "background", payload.obj("surface") - "background")
                assertEquals(expectedPayload - "surface", payload - "surface")
            }
            assertEquals(
                1,
                counts["/api/projects/project/design-systems/system/components/b/editor-bundle"],
            )
        }
    }

    @Test
    fun rejectsCyclicStyleReferenceInsteadOfSendingPartialPayload() = runBlocking {
        val http = HttpClient(
            MockEngine { request ->
                if (request.url.encodedPath.endsWith("/appearances")) {
                    respond(
                        """
[
  {
    "name": "button-group",
    "componentId": "a"
  }
]
""",
                    )
                } else {
                    respond(
                        bundle(
                            "a",
                            "ButtonGroup",
                            "button-group",
                            """
{
  "buttonStyle": {
    "type": "component_style",
    "value": "button-group"
  }
}
""",
                        ),
                    )
                }
            },
        )
        http.use {
            val component = CatalogComponent("a", "ButtonGroup")
            val loader = ComponentDraftLoader(
                ComponentCatalog(apiFor(it)),
                context,
                this@runBlocking,
                listOf(component),
            )
            val bundle = loader.bundle(component)
            val error = assertFailsWith<PreviewAssemblyException> {
                loader.draft(
                    bundle,
                    bundle.configurations.single(),
                    emptyMap(),
                    "light",
                    "ButtonGroup",
                )
            }
            assertEquals("cycle", error.diagnostic.code)
        }
    }

    @Test
    fun keepsSelectedVersionAndTenantAndUsesDarkAndroidValue() = runBlocking {
        val selectedContext = context.copy(versionId = "version-42")
        val http = HttpClient(
            MockEngine { request ->
                assertEquals(HttpMethod.Get, request.method)
                assertEquals("version-42", request.url.parameters["versionId"])
                val content = when {
                    request.url.encodedPath.endsWith("/editor-bundle") ->
                        bundle(
                            "a",
                            "BasicButton",
                            "basic-button",
                            """
{
  "height": {
    "type": "dimension",
    "value": "size.height"
  }
}
""",
                        )
                    request.url.encodedPath.endsWith("/appearances") -> "[]"
                    request.url.encodedPath.endsWith("/tokens") ->
                        """
[
  {
    "id": "height",
    "name": "size.height",
    "type": "spacing",
    "enabled": true
  }
]
"""
                    request.url.encodedPath.endsWith("/token-values") -> {
                        assertEquals("android", request.url.parameters["platforms"])
                        assertEquals(
                            "/api/projects/project/design-systems/system/tenants/tenant/token-values",
                            request.url.encodedPath,
                        )
                        """
[
  {
    "tokenId": "height",
    "tenantId": "tenant",
    "platform": "android",
    "mode": "dark",
    "value": [
      {
        "value": 16
      }
    ]
  },
  {
    "tokenId": "height",
    "tenantId": "tenant",
    "platform": "android",
    "mode": "light",
    "value": [
      {
        "value": 24
      }
    ]
  },
  {
    "tokenId": "height",
    "tenantId": "other",
    "platform": "android",
    "mode": "dark",
    "value": [
      {
        "value": 99
      }
    ]
  },
  {
    "tokenId": "height",
    "tenantId": "tenant",
    "platform": "web",
    "mode": "dark",
    "value": "99px"
  }
]
"""
                    }
                    else -> error("Unexpected request")
                }
                respond(content)
            },
        )
        http.use {
            val component = CatalogComponent("a", "BasicButton")
            val loader = ComponentDraftLoader(
                ComponentCatalog(apiFor(it)),
                selectedContext,
                this@runBlocking,
                listOf(component),
            )
            val bundle = loader.bundle(component)
            val draft = loader.draft(
                bundle,
                bundle.configurations.single(),
                emptyMap(),
                "dark",
                "BasicButton",
            )
            val payload = assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(draft)).payload
            assertEquals("16", payload.obj("theme").obj("size.height").text("value"))
            assertEquals("#080808FF", payload.obj("surface").text("background"))
            val light = loader.draft(bundle, bundle.configurations.single(), emptyMap(), "light", "BasicButton")
            val lightPayload = assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(light)).payload
            assertEquals("#F9F9F9FF", lightPayload.obj("surface").text("background"))
        }
    }

    @Test
    fun deniedDependencyCanBeRetriedWithoutCancellingTheUiScope() = runBlocking {
        var attempts = 0
        val http = HttpClient(
            MockEngine { request ->
                val content = when {
                    request.url.encodedPath.endsWith("/a/editor-bundle") ->
                        bundle(
                            "a",
                            "ButtonGroup",
                            "button-group",
                            """
{
  "buttonStyle": {
    "type": "component_style",
    "value": "basic-button"
  }
}
""",
                        )
                    request.url.encodedPath.endsWith("/b/editor-bundle") -> {
                        attempts++
                        if (attempts == 1) {
                            return@MockEngine respond(
                                "forbidden",
                                HttpStatusCode.Forbidden,
                            )
                        }
                        bundle(
                            "b",
                            "BasicButton",
                            "basic-button",
                            """
{
  "height": {
    "type": "dimension",
    "value": 24
  }
}
""",
                        )
                    }
                    request.url.encodedPath.endsWith("/appearances") ->
                        """
[
  {
    "name": "basic-button",
    "componentId": "b"
  }
]
"""
                    else -> "[]"
                }
                respond(content)
            },
        )
        http.use {
            val components = listOf(
                CatalogComponent(
                    "a",
                    "ButtonGroup",
                ),
                CatalogComponent(
                    "b",
                    "BasicButton",
                ),
            )
            val loader = ComponentDraftLoader(
                ComponentCatalog(apiFor(it)),
                context,
                this@runBlocking,
                components,
            )
            val bundle = loader.bundle(components.first())
            val denied = assertFailsWith<com.dsbuilder.frontend.plugin.androidstudio.api.ApiRequestException> {
                loader.draft(
                    bundle,
                    bundle.configurations.single(),
                    emptyMap(),
                    "light",
                    "ButtonGroup",
                )
            }
            assertEquals(403, denied.statusCode)
            val draft = loader.draft(
                bundle,
                bundle.configurations.single(),
                emptyMap(),
                "light",
                "ButtonGroup",
            )
            assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(draft))
            assertEquals(2, attempts)
        }
    }

    @Test
    fun rejectsTheSixthReferenceBeforeLoadingItsTarget() = runBlocking {
        val seen = mutableListOf<Int>()
        val components = (0..6).map { CatalogComponent(it.toString(), "Component$it") }
        val appearances = (0..6).joinToString(",") {
            """
{
  "name": "config$it",
  "componentId": "$it"
}
"""
        }
        val http = HttpClient(
            MockEngine { request ->
                if (request.url.encodedPath.endsWith("/appearances")) return@MockEngine respond("[$appearances]")
                val id = request.url.encodedPath.substringBeforeLast('/').substringAfterLast('/').toInt()
                seen.add(id)
                respond(
                    bundle(
                        id.toString(),
                        "Component$id",
                        "config$id",
                        """
{
  "buttonStyle": {
    "type": "component_style",
    "value": "config${id + 1}"
  }
}
""",
                    ),
                )
            },
        )
        http.use {
            val loader = ComponentDraftLoader(
                ComponentCatalog(apiFor(it)),
                context,
                this@runBlocking,
                components,
            )
            val bundle = loader.bundle(components.first())
            val failure = assertFailsWith<PreviewAssemblyException> {
                loader.draft(
                    bundle,
                    bundle.configurations.single(),
                    emptyMap(),
                    "light",
                    "Component0",
                )
            }
            assertEquals("config6", failure.diagnostic.path)
            assertEquals(listOf(0, 1, 2, 3, 4, 5), seen)
        }
    }

    @Test
    fun resolvesSwitchWithConstantExportAxisMissingFromPublishedProps() = runBlocking {
        val configuration = ComponentConfiguration(
            "switch",
            "switch",
            ApiJson.parseToJsonElement(
                """{
                  "defaults":[{"id":"size","value":"l"},{"id":"toggle-size","value":"l"},
                    {"id":"view","value":"default"}],
                  "variations":[
                    {"id":"size","name":"size","values":[{"name":"l"},{"name":"m"},{"name":"s"}]},
                    {"id":"toggle-size","name":"toggle-size","values":[{"name":"l"},{"name":"s"},
                      {"name":"l","targets":[{"properties":[{"id":"size","value":"l"}]}]}]},
                    {"id":"view","name":"view","values":[{"name":"default"}]}
                  ]
                }""",
            ) as JsonObject,
        )
        val http = HttpClient(
            MockEngine { request ->
                if (request.url.encodedPath.endsWith("/active")) {
                    respond("""{"publicationId":"published"}""")
                } else {
                    assertEquals("components.switch", request.url.parameters["subject"])
                    respond(
                        """{"items":[{"kind":"component-style","subject":"components.switch",
                      "platformPayload":{"styles":[{"styleName":"Switch","variations":[
                        {"props":[{"name":"size","value":"l"},{"name":"toggle-size","value":"l"}],
                         "composeReference":"Switch.L"},
                        {"props":[{"name":"size","value":"l"},{"name":"toggle-size","value":"s"}],
                         "composeReference":"Switch.L.ToggleS"}
                      ]}]}}]}""",
                    )
                }
            },
        )
        http.use {
            val references = ComponentStyleReferences(apiFor(it))
            val selected = configuration.defaultSelections()
            assertEquals("Switch.L", references.resolve(context, configuration, selected))
            assertEquals(
                "Switch.L.ToggleS",
                references.resolve(context, configuration, selected + ("toggle-size" to "s")),
            )
            assertNull(references.resolve(context, configuration, selected + ("size" to "unknown")))
            assertNull(references.resolve(context, configuration, selected + ("view" to "other")))
            assertNull(references.resolve(context, configuration, selected - "toggle-size"))
        }
    }

    @Test
    fun resolvesPublishedComposeReferenceAndPropagatesRequestErrors() = runBlocking {
        var forbidden = false
        val http = HttpClient(
            MockEngine { request ->
                assertEquals(HttpMethod.Get, request.method)
                if (forbidden) return@MockEngine respond("forbidden", HttpStatusCode.Forbidden)
                val content = if (request.url.encodedPath.endsWith("/active")) {
                    assertEquals("system", request.url.parameters["designSystemId"])
                    assertEquals("compose", request.url.parameters["platform"])
                    """{"publicationId":"published"}"""
                } else {
                    assertEquals(
                        "/api/projects/project/documentation/publications/published/bindings",
                        request.url.encodedPath,
                    )
                    assertEquals("component-style", request.url.parameters["kind"])
                    assertEquals("components.BasicButton", request.url.parameters["subject"])
                    """{"items":[{"kind":"component-style","subject":"components.BasicButton",
                    "platformPayload":{"styles":[{"styleName":"basic-button","variations":[
                      {"props":[{"name":"size","value":"M"}],"composeReference":"Button.M"}]}]}}]}"""
                }
                respond(content)
            },
        )
        http.use {
            val references = ComponentStyleReferences(apiFor(it))
            val configuration =
                ComponentConfiguration("BasicButton", "BasicButton", ApiJson.parseToJsonElement("{}") as JsonObject)
            assertEquals("Button.M", references.resolve(context, configuration, mapOf("size" to "m")))
            forbidden = true
            val failure = assertFailsWith<com.dsbuilder.frontend.plugin.androidstudio.api.ApiRequestException> {
                references.resolve(context, configuration, mapOf("size" to "m"))
            }
            assertEquals(403, failure.statusCode)
        }
    }

    @Test
    fun rejectsMissingAndAmbiguousReferenceTargets() = runBlocking {
        listOf(emptyList(), listOf("b", "c")).forEach { targetIds ->
            val appearances = targetIds.joinToString(",") { id ->
                """{"name":"nested","componentId":"$id"}"""
            }
            val http = HttpClient(
                MockEngine { request ->
                    val content = if (request.url.encodedPath.endsWith("/appearances")) {
                        "[$appearances]"
                    } else {
                        val id = request.url.encodedPath.substringBeforeLast('/').substringAfterLast('/')
                        val properties = if (id == "a") {
                            """{"buttonStyle":{"type":"component_style","value":"nested"}}"""
                        } else {
                            """{"height":{"type":"dimension","value":24}}"""
                        }
                        bundle(id, if (id == "a") "ButtonGroup" else "BasicButton", "nested", properties)
                    }
                    respond(content)
                },
            )
            http.use {
                val components = listOf("a", "b", "c").map { id -> CatalogComponent(id, "Component$id") }
                val loader = ComponentDraftLoader(ComponentCatalog(apiFor(it)), context, this@runBlocking, components)
                val root = loader.bundle(components.first())
                val failure = assertFailsWith<PreviewAssemblyException> {
                    loader.draft(root, root.configurations.single(), emptyMap(), "light", "ButtonGroup")
                }
                assertEquals("invalid_reference", failure.diagnostic.code)
                assertEquals("nested", failure.diagnostic.path)
            }
        }
    }

    @Test
    fun includesTransitiveStylesAndReusesSuccessfulHttpReads() = runBlocking {
        val reads = mutableMapOf<String, Int>()
        val http = HttpClient(
            MockEngine { request ->
                val path = request.url.encodedPath
                reads[path] = (reads[path] ?: 0) + 1
                val content = when {
                    path.endsWith("/appearances") ->
                        """[
                  {"name":"nested1","componentId":"1"},
                  {"name":"nested2","componentId":"2"}]"""
                    path.endsWith("/editor-bundle") -> {
                        val id = path.substringBeforeLast('/').substringAfterLast('/').toInt()
                        val properties = if (id < 2) {
                            """{"buttonStyle":{"type":"component_style","value":"nested${id + 1}"}}"""
                        } else {
                            """{"height":{"type":"dimension","value":24}}"""
                        }
                        bundle(id.toString(), "Component$id", "nested$id", properties)
                    }
                    else -> "[]"
                }
                respond(content)
            },
        )
        http.use {
            val components = (0..2).map { CatalogComponent(it.toString(), "Component$it") }
            val loader = ComponentDraftLoader(ComponentCatalog(apiFor(it)), context, this@runBlocking, components)
            val root = loader.bundle(components.first())
            repeat(2) {
                val draft = loader.draft(root, root.configurations.single(), emptyMap(), "light", "Component0")
                val payload = assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(draft)).payload
                assertEquals(setOf("nested1", "nested2"), payload.obj("styles").keys)
            }
            assertEquals(1, reads["/api/projects/project/design-systems/system/components/2/editor-bundle"])
        }
    }

    @Test
    fun loadsStateStyleReferencesAndKeepsTheirStateSourcesInPayload() = runBlocking {
        val http = HttpClient(
            MockEngine { request ->
                val path = request.url.encodedPath
                val content = when {
                    path.endsWith("/appearances") ->
                        """[
                  {"name":"normal","componentId":"1"},{"name":"pressed","componentId":"2"}]"""
                    path.endsWith("/editor-bundle") -> {
                        val id = path.substringBeforeLast('/').substringAfterLast('/').toInt()
                        val properties = if (id == 0) {
                            """{"buttonStyle":{"type":"component_style","value":"normal","states":[
                          {"state":["pressed"],"value":"pressed"}]}}"""
                        } else {
                            """{"height":{"type":"dimension","value":${id * 12}}}"""
                        }
                        bundle(id.toString(), "Component$id", if (id == 1) "normal" else "pressed", properties)
                    }
                    else -> "[]"
                }
                respond(content)
            },
        )
        http.use {
            val components = (0..2).map { CatalogComponent(it.toString(), "Component$it") }
            val loader = ComponentDraftLoader(ComponentCatalog(apiFor(it)), context, this@runBlocking, components)
            val root = loader.bundle(components.first())
            val draft = loader.draft(root, root.configurations.single(), emptyMap(), "light", "Component0")
            val payload = assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(draft)).payload
            assertEquals(setOf("normal", "pressed"), payload.obj("styles").keys)
            val property = payload.obj("component").obj("properties").obj("buttonStyle")
            assertEquals("normal", property.obj("base").text("styleId"))
            val states = property["states"] as kotlinx.serialization.json.JsonArray
            assertEquals("pressed", (states.single() as JsonObject).obj("source").text("styleId"))
        }
    }

    @Test
    fun loadsIconsUsedOnlyByAPropertyState() = runBlocking {
        val http = HttpClient(
            MockEngine { request ->
                val content = when {
                    request.url.encodedPath.endsWith("/editor-bundle") -> bundle(
                        "a",
                        "BasicButton",
                        "button",
                        """{"height":{"type":"icon","value":"plus.16","states":[
                      {"state":["pressed"],"value":"close.16"}]}}""",
                    ).replace("height", "icon")
                    request.url.encodedPath.endsWith("/icons") ->
                        """{
                  "assetsBaseUrl":"https://plugin.example/icons","icons":[
                    {"legacyKey":"plus.outline","name":"plus","sizes":[16]},
                    {"legacyKey":"close.outline","name":"close","sizes":[16]}]}"""
                    else -> "[]"
                }
                respond(content)
            },
        )
        http.use {
            val component = CatalogComponent("a", "BasicButton")
            val loader =
                ComponentDraftLoader(ComponentCatalog(apiFor(it)), context, this@runBlocking, listOf(component))
            val root = loader.bundle(component)
            val draft = loader.draft(root, root.configurations.single(), emptyMap(), "light", "BasicButton")
            val payload = assertIs<AssemblyResult.Success>(PayloadAssembler.assemble(draft)).payload
            val assets = payload["assets"] as kotlinx.serialization.json.JsonArray
            assertEquals(setOf("icon:plus.16", "icon:close.16"), assets.map { (it as JsonObject).text("id") }.toSet())
        }
    }

    @Test
    fun cachedTargetDoesNotBypassDepthLimitOnAnotherStatePath() = runBlocking {
        val references = mapOf("B" to "C", "D1" to "D2", "D2" to "D3", "D3" to "D4", "D4" to "B")
        val ids = listOf("root", "B", "C", "D1", "D2", "D3", "D4")
        val counts = mutableMapOf<String, Int>()
        val appearances = ids.joinToString(",") { """{"name":"$it","componentId":"$it"}""" }
        val http = HttpClient(
            MockEngine { request ->
                val path = request.url.encodedPath
                val content = if (path.endsWith("/appearances")) {
                    "[$appearances]"
                } else {
                    val id = path.substringBeforeLast('/').substringAfterLast('/')
                    counts[id] = (counts[id] ?: 0) + 1
                    val properties = when {
                        id == "root" ->
                            """{"buttonStyle":{"type":"component_style","value":"B","states":[
                      {"state":["pressed"],"value":"D1"}]}}"""
                        id in references -> """{"buttonStyle":{"type":"component_style","value":"${references[id]}"}}"""
                        else -> """{"height":{"type":"dimension","value":24}}"""
                    }
                    bundle(id, "Component$id", id, properties)
                }
                respond(content)
            },
        )
        http.use {
            val components = ids.map { CatalogComponent(it, "Component$it") }
            val loader = ComponentDraftLoader(ComponentCatalog(apiFor(it)), context, this@runBlocking, components)
            val root = loader.bundle(components.first())
            val failure = assertFailsWith<PreviewAssemblyException> {
                loader.draft(root, root.configurations.single(), emptyMap(), "light", "Componentroot")
            }
            assertEquals("C", failure.diagnostic.path)
            assertEquals("cycle", failure.diagnostic.code)
            assertEquals(1, counts["B"])
            assertEquals(1, counts["C"])
        }
    }
}
