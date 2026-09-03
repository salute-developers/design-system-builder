package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.core.config.CliFileSystem
import com.dsbuilder.frontend.cli.core.config.CredentialReference
import com.dsbuilder.frontend.cli.core.config.CredentialReferenceType
import com.dsbuilder.frontend.cli.core.config.ProjectConfig
import com.dsbuilder.frontend.cli.core.config.ProjectConfigCodec
import com.dsbuilder.frontend.cli.core.config.ProjectConfigException
import com.dsbuilder.frontend.cli.core.config.ProjectConfigStore
import com.dsbuilder.frontend.cli.core.config.ProjectConfigTenant
import com.dsbuilder.frontend.cli.core.credentials.ApiKeyResolver
import com.dsbuilder.frontend.cli.core.credentials.EnvironmentReader
import com.dsbuilder.frontend.cli.core.credentials.MissingApiKeyException
import com.dsbuilder.frontend.cli.core.http.ApiUrlResolver
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClient
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpResponse
import com.dsbuilder.frontend.cli.core.http.AuthenticatedHttpResult
import com.dsbuilder.frontend.cli.core.http.DEFAULT_API_URL
import com.dsbuilder.frontend.cli.core.http.KtorAuthenticatedHttpClientFactory
import com.dsbuilder.frontend.cli.core.http.MultipartFile
import com.dsbuilder.frontend.cli.feature.theme.domain.PaletteItem
import com.dsbuilder.frontend.cli.feature.theme.domain.Platform
import com.dsbuilder.frontend.cli.feature.theme.domain.Tenant
import com.dsbuilder.frontend.cli.feature.theme.domain.TenantDirectoryNormalizer
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlanBuildResult
import com.dsbuilder.frontend.cli.feature.theme.domain.ThemeWritePlanBuilder
import com.dsbuilder.frontend.cli.feature.theme.domain.Token
import com.dsbuilder.frontend.cli.feature.theme.domain.TokenValue
import com.dsbuilder.frontend.cli.feature.theme.domain.TokenValueNormalizationResult
import com.dsbuilder.frontend.cli.feature.theme.domain.TokenValueNormalizer
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okio.Buffer
import okio.Sink
import okio.buffer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class DsBuilderCliTest {
    @Test
    fun defaultInvocationReturnsHelpText() {
        val result = DsBuilderCli(fakeRuntime()).execute(emptyList())

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Usage: dsbuilder"))
        assertTrue(result.output.contains("init"))
        assertTrue(result.output.contains("status"))
        assertTrue(result.output.contains("theme"))
    }

    @Test
    fun versionInvocationReturnsVersionText() {
        val result = DsBuilderCli(fakeRuntime()).execute(listOf("--version"))

        assertEquals(0, result.exitCode)
        assertEquals("dsbuilder version 0.1.0", result.output)
    }

    @Test
    fun configCodecSerializesProjectAndCredentialReferenceOnly() {
        val codec = ProjectConfigCodec()

        val text = codec.encode(projectConfig())
        val decoded = codec.decode(text)

        assertEquals("project-a", decoded.projectId)
        assertEquals("design-system-a", decoded.designSystemId)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", decoded.credential.name)
        assertFalse(text.contains("apiKey"))
        assertFalse(text.contains("apiUrl"))
        assertFalse(text.contains("secret-value"))
    }

    @Test
    fun configCodecReadsConfigWithoutTenantsAndWritesConfigWithTenants() {
        val codec = ProjectConfigCodec()
        val legacy = """
            {
              "projectId": "project-a",
              "designSystemId": "design-system-a",
              "credential": {
                "type": "env",
                "name": "DSBUILDER_PROJECT_A_API_KEY"
              }
            }
        """.trimIndent()

        val decodedLegacy = codec.decode(legacy)
        val encoded = codec.encode(
            decodedLegacy.copy(
                tenants = listOf(
                    ProjectConfigTenant(
                        id = "tenant-a",
                        designSystemId = "design-system-a",
                        name = "SDDS CS",
                        description = "Tenant",
                        createdAt = "2026-06-04T07:37:55.526Z",
                        updatedAt = "2026-06-04T07:37:55.526Z",
                        alias = "main",
                    ),
                ),
            ),
        )
        val decodedWithTenants = codec.decode(encoded)

        assertEquals(emptyList(), decodedLegacy.tenants)
        assertEquals(null, decodedLegacy.palettePath)
        assertEquals("tenant-a", decodedWithTenants.tenants.single().id)
        assertEquals(null, decodedWithTenants.tenants.single().directoryPath)
        assertEquals("main", decodedWithTenants.tenants.single().alias)
        assertFalse(encoded.contains("apiKey"))
        assertFalse(encoded.contains("apiUrl"))
        assertFalse(encoded.contains("secret-value"))
    }

    @Test
    fun configCodecReadsTenantsWithoutAlias() {
        val codec = ProjectConfigCodec()
        val text = """
            {
              "projectId": "project-a",
              "designSystemId": "design-system-a",
              "credential": {
                "type": "env",
                "name": "DSBUILDER_PROJECT_A_API_KEY"
              },
              "tenants": [
                {
                  "id": "tenant-a",
                  "designSystemId": "design-system-a",
                  "name": "SDDS CS",
                  "description": "Tenant",
                  "directoryPath": ".sdds/sdds_cs",
                  "createdAt": "2026-06-04T07:37:55.526Z",
                  "updatedAt": "2026-06-04T07:37:55.526Z"
                }
              ]
            }
        """.trimIndent()

        val decoded = codec.decode(text)

        assertEquals(null, decoded.tenants.single().alias)
    }

    @Test
    fun configCodecReadsAndWritesPalettePath() {
        val codec = ProjectConfigCodec()
        val encoded = codec.encode(projectConfig().copy(palettePath = ".sdds/tenants/palette.json"))
        val decoded = codec.decode(encoded)

        assertEquals(".sdds/tenants/palette.json", decoded.palettePath)
        assertFalse(encoded.contains("apiKey"))
        assertFalse(encoded.contains("apiUrl"))
    }

    @Test
    fun configStoreUpdatesTenantsAndPreservesProjectCredentialMetadata() {
        val fileSystem = initializedFileSystem()
        val store = ProjectConfigStore(fileSystem)
        val context = store.requireNearestContext()

        store.updateTenants(
            context = context,
            tenants = listOf(configTenant("tenant-a")),
        )
        val updated = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))

        assertEquals("project-a", updated.projectId)
        assertEquals("design-system-a", updated.designSystemId)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", updated.credential.name)
        assertEquals("tenant-a", updated.tenants.single().id)
        assertEquals(".sdds/tenants/sdds_cs", updated.tenants.single().directoryPath)
        assertEquals(null, updated.palettePath)
    }

    @Test
    fun configStoreUpdatesTenantsPreservingAliasesByTenantId() {
        val fileSystem = initializedFileSystem()
        val store = ProjectConfigStore(fileSystem)
        store.updateConfig("/repo/.sdds/config.json") { config ->
            config.copy(palettePath = ".sdds/tenants/palette.json")
        }
        store.updateTenants(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(
                configTenant("tenant-a").copy(alias = "main"),
                configTenant("removed-tenant").copy(alias = "removed"),
            ),
        )

        store.updateTenantsPreservingAliases(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(
                configTenant("tenant-a").copy(name = "Fresh Tenant"),
                configTenant("tenant-b"),
            ),
        )
        val updated = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))

        assertEquals("main", updated.tenants.first { it.id == "tenant-a" }.alias)
        assertEquals("Fresh Tenant", updated.tenants.first { it.id == "tenant-a" }.name)
        assertEquals(null, updated.tenants.first { it.id == "tenant-b" }.alias)
        assertFalse(updated.tenants.any { it.id == "removed-tenant" })
        assertEquals(".sdds/tenants/palette.json", updated.palettePath)
        assertFalse(fileSystem.readText("/repo/.sdds/config.json").contains("apiUrl"))
    }

    @Test
    fun configDiscoveryUsesCurrentDirectoryConfig() {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo/package-a")
        fileSystem.writeText("/repo/package-a/.sdds/config.json", ProjectConfigCodec().encode(projectConfig("current")))

        val context = ProjectConfigStore(fileSystem).requireNearestContext()

        assertEquals("current", context.config.projectId)
        assertEquals("/repo/package-a/.sdds/config.json", context.configPath)
    }

    @Test
    fun configDiscoveryUsesNearestParentConfig() {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo/package-a/src")
        fileSystem.writeText("/repo/.sdds/config.json", ProjectConfigCodec().encode(projectConfig("root")))
        fileSystem.writeText("/repo/package-a/.sdds/config.json", ProjectConfigCodec().encode(projectConfig("nearest")))

        val context = ProjectConfigStore(fileSystem).requireNearestContext()

        assertEquals("nearest", context.config.projectId)
        assertEquals("/repo/package-a/.sdds/config.json", context.configPath)
    }

    @Test
    fun missingConfigReturnsDeterministicError() {
        val exception = assertFailsWith<ProjectConfigException> {
            ProjectConfigStore(FakeFileSystem(currentDirectory = "/repo")).requireNearestContext()
        }

        assertNotNull(exception.message)
        assertTrue(exception.message!!.contains("Project is not initialized"))
    }

    @Test
    fun apiKeyArgumentHasPriorityOverEnvironment() {
        val resolver = ApiKeyResolver(
            EnvironmentReader { name ->
                when (name) {
                    "DSBUILDER_PROJECT_A_API_KEY" -> "from-config-env"
                    "DSBUILDER_API_KEY" -> "from-default-env"
                    else -> null
                }
            },
        )

        val result = resolver.resolve("from-arg", projectConfig().credential)

        assertEquals("from-arg", result.value)
        assertEquals("--api-key", result.source)
    }

    @Test
    fun apiKeyUsesConfiguredEnvThenFallbackEnv() {
        val configured = ApiKeyResolver(
            EnvironmentReader { name ->
                if (name == "DSBUILDER_PROJECT_A_API_KEY") "from-config-env" else null
            },
        ).resolve(null, projectConfig().credential)
        val fallback = ApiKeyResolver(
            EnvironmentReader { name ->
                if (name == "DSBUILDER_API_KEY") "from-default-env" else null
            },
        ).resolve(null, projectConfig().credential)

        assertEquals("from-config-env", configured.value)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", configured.source)
        assertEquals("from-default-env", fallback.value)
        assertEquals("DSBUILDER_API_KEY", fallback.source)
    }

    @Test
    fun missingApiKeyMentionsConfiguredEnvName() {
        val exception = assertFailsWith<MissingApiKeyException> {
            ApiKeyResolver(EnvironmentReader { null }).resolve(null, projectConfig().credential)
        }

        assertNotNull(exception.message)
        assertTrue(exception.message!!.contains("DSBUILDER_PROJECT_A_API_KEY"))
        assertTrue(exception.message!!.contains("DSBUILDER_API_KEY"))
    }

    @Test
    fun apiUrlResolutionUsesArgumentThenEnvThenDefault() {
        val resolver = ApiUrlResolver(
            EnvironmentReader { name ->
                if (name == "DSBUILDER_API_URL") "https://env.example.com" else null
            },
        )

        assertEquals("https://arg.example.com", resolver.resolve("https://arg.example.com").value)
        assertEquals("https://env.example.com", resolver.resolve(null).value)
        assertEquals(DEFAULT_API_URL, ApiUrlResolver(EnvironmentReader { null }).resolve(null).value)
    }

    @Test
    fun ktorHttpClientSendsProjectKeyAuthorizationAndMapsErrors() {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(content = "{}", status = HttpStatusCode.Unauthorized)
        }
        val client = KtorAuthenticatedHttpClientFactory { HttpClient(engine) }.create(
            apiUrl = "https://api.example.com",
            apiKey = "secret-value",
        )

        val result = client.get("/api/projects/project-a")

        assertEquals(AuthenticatedHttpResult.Failure("Status: unauthorized. API key is missing or invalid."), result)
        assertEquals("/api/projects/project-a", request!!.url.encodedPath)
        assertEquals("ProjectKey secret-value", request!!.headers[HttpHeaders.Authorization])
    }

    @Test
    fun ktorHttpClientSendsAuthenticatedMultipartRequest() {
        var request: HttpRequestData? = null
        val engine = MockEngine {
            request = it
            respond(content = """{"bundleId":"bundle-a","jobId":"job-a","status":"accepted"}""")
        }
        val client = KtorAuthenticatedHttpClientFactory { HttpClient(engine) }.create(
            apiUrl = "https://api.example.com/",
            apiKey = "secret-value",
        )

        val response = client.postMultipart(
            "/api/projects/project-a/documentation/bundles",
            MultipartFile("bundle", "docs-bundle.tar.gz", "application/gzip", byteArrayOf(1, 2, 3)),
        )

        assertEquals(200, response.statusCode)
        assertEquals("/api/projects/project-a/documentation/bundles", request!!.url.encodedPath)
        assertEquals("ProjectKey secret-value", request!!.headers[HttpHeaders.Authorization])
        assertTrue(request!!.body.contentType?.toString()?.startsWith("multipart/form-data") == true)
    }

    @Test
    fun docsPublishUploadsDefaultBundleAndPrintsAcceptedIdentifiers() {
        val fileSystem = initializedFileSystem()
        fileSystem.writeBytes("/.sdds/temp/docs-bundle.tar.gz", byteArrayOf(1, 2, 3))
        var uploadedPath = ""
        var uploadedFile: MultipartFile? = null
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                multipartResponse = AuthenticatedHttpResponse(
                    202,
                    """{"bundleId":"bundle-a","jobId":"job-a"}""",
                ),
                onPost = { path, file ->
                    uploadedPath = path
                    uploadedFile = file
                },
            ),
        ).execute(listOf("docs", "publish"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Bundle ID: bundle-a"))
        assertTrue(result.output.contains("Job ID: job-a"))
        assertEquals("/api/projects/project-a/documentation/bundles", uploadedPath)
        assertEquals("bundle", uploadedFile!!.partName)
        assertEquals("docs-bundle.tar.gz", uploadedFile!!.fileName)
        assertEquals("application/gzip", uploadedFile!!.contentType)
    }

    @Test
    fun docsPublishUsesOverridesAndFormatsStructuredFailure() {
        val fileSystem = initializedFileSystem()
        fileSystem.writeBytes("/custom.tar.gz", byteArrayOf(4, 5))
        var createdApiUrl = ""
        var createdApiKey = ""
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                multipartResponse = AuthenticatedHttpResponse(
                    422,
                    """{"errors":[{"code":"INVALID_CONTENT","message":"Invalid bundle","path":"docs.json"}]}""",
                ),
                onCreate = { url, key ->
                    createdApiUrl = url
                    createdApiKey = key
                },
            ),
        ).execute(
            listOf(
                "docs",
                "publish",
                "--bundle",
                "/custom.tar.gz",
                "--api-key",
                "override-key",
                "--api-url",
                "https://override.example.com",
            ),
        )

        assertEquals(1, result.exitCode)
        assertEquals("https://override.example.com", createdApiUrl)
        assertEquals("override-key", createdApiKey)
        assertTrue(result.output.contains("HTTP 422"))
        assertTrue(result.output.contains("INVALID_CONTENT"))
        assertTrue(result.output.contains("docs.json"))
    }

    @Test
    fun docsPublishRejectsMissingBundleBeforeRequest() {
        val fileSystem = initializedFileSystem()
        var posted = false
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                onPost = { _, _ -> posted = true },
            ),
        ).execute(listOf("docs", "publish"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("Bundle file was not found"))
        assertFalse(posted)
    }

    @Test
    fun docsPublishRejectsMissingProjectContextAndApiKeyBeforeRequest() {
        var posted = false
        val missingContext = DsBuilderCli(
            fakeRuntime(onPost = { _, _ -> posted = true }),
        ).execute(listOf("docs", "publish"))
        val fileSystem = initializedFileSystem().apply {
            writeBytes("/.sdds/temp/docs-bundle.tar.gz", byteArrayOf(1))
        }
        val missingKey = DsBuilderCli(
            fakeRuntime(fileSystem = fileSystem, onPost = { _, _ -> posted = true }),
        ).execute(listOf("docs", "publish"))

        assertEquals(1, missingContext.exitCode)
        assertTrue(missingContext.output.contains("Project is not initialized"))
        assertEquals(1, missingKey.exitCode)
        assertTrue(missingKey.output.contains("API key is not configured"))
        assertFalse(posted)
    }

    @Test
    fun docsPublishUsesSafeFallbackForHttpAndTransportFailures() {
        val statuses = listOf(400, 401, 403, 413, 415, 503)
        statuses.forEach { status ->
            val fileSystem = initializedFileSystem().apply {
                writeBytes("/.sdds/temp/docs-bundle.tar.gz", byteArrayOf(1))
            }
            val result = DsBuilderCli(
                fakeRuntime(
                    fileSystem = fileSystem,
                    environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                    multipartResponse = AuthenticatedHttpResponse(status, "not-json-secret-body"),
                ),
            ).execute(listOf("docs", "publish"))

            assertEquals(1, result.exitCode)
            assertTrue(result.output.contains("HTTP $status"))
            assertFalse(result.output.contains("not-json-secret-body"))
            assertFalse(result.output.contains("secret-value"))
        }

        val transportFileSystem = initializedFileSystem().apply {
            writeBytes("/.sdds/temp/docs-bundle.tar.gz", byteArrayOf(1))
        }
        val transport = DsBuilderCli(
            fakeRuntime(
                fileSystem = transportFileSystem,
                environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                onCreate = { _, _ -> error("network details") },
            ),
        ).execute(listOf("docs", "publish"))
        assertEquals(1, transport.exitCode)
        assertTrue(transport.output.contains("upload is unavailable"))
        assertFalse(transport.output.contains("network details"))
    }

    @Test
    fun initCommandCreatesConfigAndProtectsExistingConfig() {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo")
        val cli = DsBuilderCli(fakeRuntime(fileSystem = fileSystem))

        val result = cli.execute(
            listOf(
                "init",
                "--project-id",
                "project-a",
                "--design-system-id",
                "design-system-a",
                "--api-key-env",
                "DSBUILDER_PROJECT_A_API_KEY",
            ),
        )
        val second = cli.execute(
            listOf(
                "init",
                "--project-id",
                "project-b",
                "--design-system-id",
                "design-system-b",
                "--api-key-env",
                "DSBUILDER_PROJECT_B_API_KEY",
            ),
        )
        val configText = fileSystem.readText("/repo/.sdds/config.json")

        assertEquals(0, result.exitCode)
        assertEquals(1, second.exitCode)
        assertTrue(second.output.contains("already exists"))
        assertTrue(configText.contains("project-a"))
        assertTrue(configText.contains("design-system-a"))
        assertTrue(configText.contains("DSBUILDER_PROJECT_A_API_KEY"))
        assertFalse(configText.contains("apiKey"))
        assertFalse(configText.contains("apiUrl"))
    }

    @Test
    fun initCommandUsesDefaultApiKeyEnvWhenOptionIsOmitted() {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo")
        val cli = DsBuilderCli(fakeRuntime(fileSystem = fileSystem))

        val result = cli.execute(
            listOf("init", "--project-id", "project-a", "--design-system-id", "design-system-a"),
        )
        val configText = fileSystem.readText("/repo/.sdds/config.json")

        assertEquals(0, result.exitCode)
        assertTrue(configText.contains("project-a"))
        assertTrue(configText.contains("design-system-a"))
        assertTrue(configText.contains("DSBUILDER_API_KEY"))
        assertFalse(configText.contains("apiKey"))
        assertFalse(configText.contains("apiUrl"))
    }

    @Test
    fun statusCommandPrintsAuthorizedStatusWithoutSecret() {
        val fileSystem = initializedFileSystem()
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a" to AuthenticatedHttpResult.Success(
                    """{"id":"project-a","name":"SDDS"}""",
                ),
                "/api/projects/project-a/ds/design-systems/design-system-a" to AuthenticatedHttpResult.Success(
                    """{"id":"internal-id","designSystemId":"design-system-a","name":"sdds_cs"}""",
                ),
            ),
        )

        val result = DsBuilderCli(runtime).execute(listOf("status"))

        assertEquals(0, result.exitCode)
        assertTrue(result.output.contains("Project: SDDS"))
        assertTrue(result.output.contains("Design system: sdds_cs"))
        assertTrue(result.output.contains("Status: authorized"))
        assertFalse(result.output.contains("secret-value"))
    }

    @Test
    fun statusCommandMapsFailuresWithoutSecret() {
        val runtime = fakeRuntime(
            fileSystem = initializedFileSystem(),
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResult = AuthenticatedHttpResult.Failure("Status: forbidden. API key has no access to this project."),
        )

        val result = DsBuilderCli(runtime).execute(listOf("status"))

        assertEquals(1, result.exitCode)
        assertEquals("Status: forbidden. API key has no access to this project.", result.output)
        assertFalse(result.output.contains("secret-value"))
    }

    @Test
    fun statusCommandUsesConfiguredProjectEndpointOnly() {
        val calls = mutableListOf<String>()
        val runtime = fakeRuntime(
            fileSystem = initializedFileSystem(),
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a" to AuthenticatedHttpResult.Success(
                    """{"id":"project-a","name":"SDDS"}""",
                ),
                "/api/projects/project-a/ds/design-systems/design-system-a" to AuthenticatedHttpResult.Success(
                    """{"id":"internal-id","designSystemId":"design-system-a","name":"sdds_cs"}""",
                ),
            ),
            onGet = { path -> calls += path },
        )

        DsBuilderCli(runtime).execute(listOf("status"))

        assertEquals(
            listOf(
                "/api/projects/project-a",
                "/api/projects/project-a/ds/design-systems/design-system-a",
            ),
            calls,
        )
        assertFalse(calls.contains("/api/projects"))
    }

    @Test
    fun commandErrorsAreDeterministicAndDoNotRequireRuntimeContext() {
        val runtime = fakeRuntime()

        val missingOption = DsBuilderCli(runtime).execute(listOf("init"))
        val unknown = DsBuilderCli(runtime).execute(listOf("unknown-command"))
        val help = DsBuilderCli(runtime).execute(listOf("--help"))

        assertEquals(1, missingOption.exitCode)
        assertTrue(missingOption.output.contains("missing option --project-id"))
        assertEquals(1, unknown.exitCode)
        assertTrue(unknown.output.contains("unknown-command"))
        assertEquals(0, help.exitCode)
        assertTrue(help.output.contains("Usage: dsbuilder"))
    }

    @Test
    fun helpAndVersionDoNotRequireConfigOrCredentials() {
        val runtime = fakeRuntime(
            fileSystem = FakeFileSystem(currentDirectory = "/repo"),
            environment = emptyMap(),
            httpResult = AuthenticatedHttpResult.Failure("should not be called"),
        )

        val help = DsBuilderCli(runtime).execute(listOf("--help"))
        val version = DsBuilderCli(runtime).execute(listOf("--version"))

        assertEquals(0, help.exitCode)
        assertEquals(0, version.exitCode)
        assertEquals("dsbuilder version 0.1.0", version.output)
    }

    @Test
    fun themeCommandHelpDoesNotRequireConfigOrCredentials() {
        val result = DsBuilderCli(fakeRuntime()).execute(listOf("theme", "--help"))

        assertEquals(0, result.exitCode)
        assertTrue(result.output.contains("Usage: dsbuilder theme"))
        assertTrue(result.output.contains("fetch"))
        assertTrue(result.output.contains("alias"))
    }

    @Test
    fun themeAliasHelpDoesNotRequireConfigOrCredentials() {
        val result = DsBuilderCli(fakeRuntime()).execute(listOf("theme", "alias", "--help"))

        assertEquals(0, result.exitCode)
        assertTrue(result.output.contains("Usage: dsbuilder theme alias"))
        assertTrue(result.output.contains("list"))
        assertTrue(result.output.contains("set"))
        assertTrue(result.output.contains("unset"))
    }

    @Test
    fun themeAliasListPrintsTenantsAndAliasesWithoutCredentials() {
        val fileSystem = initializedFileSystem()
        ProjectConfigStore(fileSystem).updateTenants(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(configTenant("tenant-a").copy(alias = "main")),
        )

        val result = DsBuilderCli(fakeRuntime(fileSystem = fileSystem)).execute(listOf("theme", "alias", "list"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Tenant: tenant-a"))
        assertTrue(result.output.contains("Name: SDDS CS"))
        assertTrue(result.output.contains("Alias: main"))
    }

    @Test
    fun themeAliasSetAndUnsetUpdateConfig() {
        val fileSystem = initializedFileSystem()
        ProjectConfigStore(fileSystem).updateTenants(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(configTenant("tenant-a")),
        )
        val cli = DsBuilderCli(fakeRuntime(fileSystem = fileSystem))

        val set = cli.execute(listOf("theme", "alias", "set", "--tenant-id", "tenant-a", "--alias", "main"))
        val afterSet = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))
        val unset = cli.execute(listOf("theme", "alias", "unset", "main"))
        val afterUnset = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))

        assertEquals(0, set.exitCode, set.output)
        assertEquals("Alias set: main -> tenant-a", set.output)
        assertEquals("main", afterSet.tenants.single().alias)
        assertEquals(0, unset.exitCode, unset.output)
        assertEquals("Alias unset: main", unset.output)
        assertEquals(null, afterUnset.tenants.single().alias)
        assertFalse(fileSystem.readText("/repo/.sdds/config.json").contains("apiUrl"))
    }

    @Test
    fun themeAliasValidationFailuresDoNotModifyConfig() {
        val fileSystem = initializedFileSystem()
        ProjectConfigStore(fileSystem).updateTenants(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(
                configTenant("tenant-a").copy(alias = "main"),
                configTenant("tenant-b"),
            ),
        )
        val cli = DsBuilderCli(fakeRuntime(fileSystem = fileSystem))
        val original = fileSystem.readText("/repo/.sdds/config.json")

        val blank = cli.execute(listOf("theme", "alias", "set", "--tenant-id", "tenant-a", "--alias", "   "))
        val missingTenant = cli.execute(
            listOf("theme", "alias", "set", "--tenant-id", "missing-tenant", "--alias", "other"),
        )
        val duplicate = cli.execute(listOf("theme", "alias", "set", "--tenant-id", "tenant-b", "--alias", "main"))
        val missingAlias = cli.execute(listOf("theme", "alias", "unset", "missing"))

        assertEquals(1, blank.exitCode)
        assertEquals("Error: Alias must not be blank.", blank.output)
        assertEquals(1, missingTenant.exitCode)
        assertEquals("Error: Tenant not found: missing-tenant.", missingTenant.output)
        assertEquals(1, duplicate.exitCode)
        assertEquals("Error: Alias already exists: main.", duplicate.output)
        assertEquals(1, missingAlias.exitCode)
        assertEquals("Error: Alias not found: missing.", missingAlias.output)
        assertEquals(original, fileSystem.readText("/repo/.sdds/config.json"))
    }

    @Test
    fun tenantDirectoryNormalizationHandlesSymbolsEmptyNamesAndCollisions() {
        val normalizer = TenantDirectoryNormalizer()

        val result = normalizer.normalize(
            listOf(
                tenant(id = "9095ed0f-tenant", name = "SDDS CS / Consumer"),
                tenant(id = "aaaaaaaa-tenant", name = "???"),
                tenant(id = "bbbbbbbb-tenant", name = "sdds/cs"),
                tenant(id = "cccccccc-tenant", name = "sdds cs"),
            ),
        )

        assertEquals("sdds_cs_consumer", result[0].directoryName)
        assertEquals("aaaaaaaa-tenant", result[1].directoryName)
        assertEquals("sdds_cs_bbbbbbbb", result[2].directoryName)
        assertEquals("sdds_cs_cccccccc", result[3].directoryName)
    }

    @Test
    fun tokenValueNormalizerSupportsAllTokenTypes() {
        val normalizer = TokenValueNormalizer()

        val color = normalizer.normalize(
            token("color-token", "color.name", "color"),
            tokenValue("color-token", value = listOf(JsonPrimitive("#FFFFFF"))),
        )
        val gradient = normalizer.normalize(
            token("gradient-token", "gradient.name", "gradient"),
            tokenValue("gradient-token", value = listOf(jsonObject("from" to "#000000"))),
        )
        val typography = normalizer.normalize(
            token("typography-token", "typography.name", "typography"),
            tokenValue("typography-token", value = listOf(jsonObject("fontSize" to "16"))),
        )
        val shadow = normalizer.normalize(
            token("shadow-token", "shadow.name", "shadow"),
            tokenValue("shadow-token", value = listOf(jsonObject("radius" to "8"))),
        )
        val shape = normalizer.normalize(
            token("shape-token", "shape.name", "shape"),
            tokenValue("shape-token", value = listOf(jsonObject("cornerRadius" to "4"))),
        )
        val webShape = normalizer.normalize(
            token("web-shape-token", "shape.web.name", "shape"),
            tokenValue("web-shape-token", platform = Platform.WEB, value = listOf(JsonPrimitive("4"))),
        )
        val webSpacing = normalizer.normalize(
            token("web-spacing-token", "spacing.1x", "spacing"),
            tokenValue(
                "web-spacing-token",
                platform = Platform.WEB,
                value = listOf(JsonPrimitive("4")),
            ),
        )
        val androidSpacing = normalizer.normalize(
            token("android-spacing-token", "spacing.2x", "spacing"),
            tokenValue(
                "android-spacing-token",
                platform = Platform.ANDROID,
                value = listOf(jsonObject("value" to "2")),
            ),
        )
        val fontFamily = normalizer.normalize(
            token("font-token", "font.name", "fontFamily"),
            tokenValue("font-token", value = listOf(jsonObject("fontFamily" to "Inter"))),
        )

        assertEquals(JsonPrimitive("#FFFFFF"), (color as TokenValueNormalizationResult.Success).value)
        assertTrue((gradient as TokenValueNormalizationResult.Success).value is JsonArray)
        assertTrue((typography as TokenValueNormalizationResult.Success).value is JsonObject)
        assertTrue((shadow as TokenValueNormalizationResult.Success).value is JsonArray)
        assertTrue((shape as TokenValueNormalizationResult.Success).value is JsonObject)
        assertEquals(JsonPrimitive("4"), (webShape as TokenValueNormalizationResult.Success).value)
        assertEquals(JsonPrimitive("4"), (webSpacing as TokenValueNormalizationResult.Success).value)
        assertTrue((androidSpacing as TokenValueNormalizationResult.Success).value is JsonObject)
        assertTrue((fontFamily as TokenValueNormalizationResult.Success).value is JsonObject)
    }

    @Test
    fun themeWritePlanGroupsKnownValuesIgnoresUnknownValuesAndIgnoresModeLayout() {
        val result = ThemeWritePlanBuilder().build(
            tenants = listOf(tenant()),
            tokens = listOf(
                token("typography-token", "screen-s.header.h2.normal", "typography"),
            ),
            paletteItems = emptyList(),
            valuesByTenantId = mapOf(
                "tenant-a" to listOf(
                    tokenValue(
                        tokenId = "typography-token",
                        platform = Platform.ANDROID,
                        mode = "dark",
                        value = listOf(jsonObject("fontSize" to "16")),
                    ),
                    tokenValue(tokenId = "unknown-token", platform = Platform.WEB),
                ),
            ),
        ) as ThemeWritePlanBuildResult.Success

        val files = result.writePlan.files.associateBy { it.relativePath }

        assertTrue(files.containsKey("android/android_typography.json"))
        assertFalse(files.containsKey("dark/android_typography.json"))
        assertFalse(files.values.any { it.content.contains("unknown-token") })
        assertTrue(files.getValue("android/android_typography.json").content.contains("screen-s.header.h2.normal"))
    }

    @Test
    fun themeWritePlanBuildsPaletteObjectByShadeAndSaturationWithLastValueWinning() {
        val result = ThemeWritePlanBuilder().build(
            tenants = emptyList(),
            tokens = emptyList(),
            paletteItems = listOf(
                paletteItem(shade = "blue", saturation = 100, value = "#EDF8FF"),
                paletteItem(shade = "gray", saturation = 50, value = "#F8F8F8"),
                paletteItem(shade = "blue", saturation = 100, value = "#DFF2FF"),
            ),
            valuesByTenantId = emptyMap(),
        ) as ThemeWritePlanBuildResult.Success
        val palette = result.writePlan.palette.content

        assertEquals("#DFF2FF", palette.getValue("blue").jsonObject.getValue("100").jsonPrimitive.content)
        assertEquals("#F8F8F8", palette.getValue("gray").jsonObject.getValue("50").jsonPrimitive.content)
    }

    @Test
    fun themeWritePlanFailsForMissingEnabledValueAndInvalidValueBeforeWriting() {
        val missing = ThemeWritePlanBuilder().build(
            tenants = listOf(tenant()),
            tokens = listOf(token("color-token", "color.name", "color")),
            paletteItems = emptyList(),
            valuesByTenantId = mapOf("tenant-a" to emptyList()),
        )
        val invalid = ThemeWritePlanBuilder().build(
            tenants = listOf(tenant()),
            tokens = listOf(token("color-token", "color.name", "color")),
            paletteItems = emptyList(),
            valuesByTenantId = mapOf(
                "tenant-a" to listOf(tokenValue("color-token", value = listOf(jsonObject("bad" to "shape")))),
            ),
        )

        assertTrue((missing as ThemeWritePlanBuildResult.Failed).message.contains("Missing value"))
        assertTrue((invalid as ThemeWritePlanBuildResult.Failed).message.contains("Invalid value shape"))
    }

    @Test
    fun themeFetchParsesNullTokenValueAndReportsMissingValueWhenNoReplacementExists() {
        val runtime = fakeRuntime(
            fileSystem = initializedFileSystem(),
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to
                    AuthenticatedHttpResult.Success(tenantsResponse()),
                "/api/projects/project-a/ds/design-systems/design-system-a/tokens" to
                    AuthenticatedHttpResult.Success(
                        """
                            [
                              {
                                "id": "color-token",
                                "designSystemId": "design-system-a",
                                "name": "color.primary",
                                "type": "color",
                                "displayName": "Primary",
                                "description": "Primary color",
                                "enabled": true,
                                "createdAt": "2026-06-04T07:37:55.526Z",
                                "updatedAt": "2026-06-04T07:37:55.526Z"
                              }
                            ]
                        """.trimIndent(),
                    ),
                "/api/projects/project-a/ds/palette" to AuthenticatedHttpResult.Success(paletteResponse()),
                "/api/projects/project-a/ds/tenants/tenant-a/token-values" to
                    AuthenticatedHttpResult.Success(
                        """
                            [
                              {
                                "id": "value-color",
                                "tokenId": "color-token",
                                "tenantId": "tenant-a",
                                "paletteId": "palette-a",
                                "platform": "web",
                                "mode": null,
                                "value": null,
                                "createdAt": "2026-06-04T07:37:55.526Z",
                                "updatedAt": "2026-06-04T07:37:55.526Z"
                              }
                            ]
                        """.trimIndent(),
                    ),
            ),
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("Missing value"))
        assertFalse(result.output.contains("Cannot parse token values response"))
        assertFalse(result.output.contains("secret-value"))
    }

    @Test
    fun themeFetchIgnoresNullTokenValueRowsWhenNonNullValueExists() {
        val fileSystem = initializedFileSystem()
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to
                    AuthenticatedHttpResult.Success(tenantsResponse()),
                "/api/projects/project-a/ds/design-systems/design-system-a/tokens" to
                    AuthenticatedHttpResult.Success(singleColorTokenResponse()),
                "/api/projects/project-a/ds/palette" to AuthenticatedHttpResult.Success(paletteResponse()),
                "/api/projects/project-a/ds/tenants/tenant-a/token-values" to
                    AuthenticatedHttpResult.Success(nullableAndNonNullColorValuesResponse()),
            ),
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(fileSystem.readText("/repo/.sdds/tenants/sdds_cs/web/web_color.json").contains("#171717F5"))
    }

    @Test
    fun themeFetchUsesExpectedHttpPathsAndMapsParseFailuresWithoutSecret() {
        val calls = mutableListOf<String>()
        val parseFailureRuntime = fakeRuntime(
            fileSystem = initializedFileSystem(),
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to
                    AuthenticatedHttpResult.Success("""{"not":"an-array"}"""),
            ),
            onGet = { calls += it },
        )

        val result = DsBuilderCli(parseFailureRuntime).execute(listOf("theme", "fetch"))

        assertEquals(1, result.exitCode)
        assertEquals("Error: Cannot parse tenants response.", result.output)
        assertEquals(
            listOf("/api/projects/project-a/ds/design-systems/design-system-a/tenants"),
            calls,
        )
        assertFalse(result.output.contains("secret-value"))
    }

    @Test
    fun themeFetchAcceptsBackendTenantsWithNullDescriptionAndExtraFields() {
        val fileSystem = initializedFileSystem()
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to
                    AuthenticatedHttpResult.Success(
                        """
                            [
                              {
                                "id": "tenant-a",
                                "designSystemId": "design-system-a",
                                "name": "sdds_sbcom_default",
                                "description": null,
                                "colorConfig": {
                                  "dark": {
                                    "fillSaturation": 700,
                                    "strokeSaturation": 700
                                  },
                                  "light": {
                                    "fillSaturation": 700,
                                    "strokeSaturation": 700
                                  },
                                  "grayTone": "gray",
                                  "accentColor": "green"
                                },
                                "createdAt": "2026-04-16T08:27:54.689Z",
                                "updatedAt": "2026-04-16T08:27:54.689Z"
                              }
                            ]
                        """.trimIndent(),
                    ),
                "/api/projects/project-a/ds/design-systems/design-system-a/tokens" to
                    AuthenticatedHttpResult.Success("[]"),
                "/api/projects/project-a/ds/palette" to AuthenticatedHttpResult.Success(paletteResponse()),
                "/api/projects/project-a/ds/tenants/tenant-a/token-values" to
                    AuthenticatedHttpResult.Success("[]"),
            ),
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))
        val config = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals(null, config.tenants.single().description)
        assertEquals(".sdds/tenants/sdds_sbcom_default", config.tenants.single().directoryPath)
    }

    @Test
    fun themeFetchDoesNotPrintTokenValuesResponseBodyOnParseFailure() {
        val runtime = fakeRuntime(
            fileSystem = initializedFileSystem(),
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to
                    AuthenticatedHttpResult.Success(tenantsResponse()),
                "/api/projects/project-a/ds/design-systems/design-system-a/tokens" to
                    AuthenticatedHttpResult.Success("[]"),
                "/api/projects/project-a/ds/palette" to AuthenticatedHttpResult.Success(paletteResponse()),
                "/api/projects/project-a/ds/tenants/tenant-a/token-values" to
                    AuthenticatedHttpResult.Success(
                        """{"error":"unexpected wrapper","apiKey":"secret-value"}""",
                    ),
            ),
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("Cannot parse token values response"))
        assertFalse(result.output.contains("Response body:"))
        assertFalse(result.output.contains("unexpected wrapper"))
        assertFalse(result.output.contains("secret-value"))
    }

    @Test
    fun themeFetchDoesNotWritePartialFilesOnPaletteParseFailure() {
        val fileSystem = initializedFileSystem()
        val originalConfig = fileSystem.readText("/repo/.sdds/config.json")
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to
                    AuthenticatedHttpResult.Success(tenantsResponse()),
                "/api/projects/project-a/ds/design-systems/design-system-a/tokens" to
                    AuthenticatedHttpResult.Success("[]"),
                "/api/projects/project-a/ds/palette" to
                    AuthenticatedHttpResult.Success("""{"not":"an-array","apiKey":"secret-value"}"""),
            ),
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))

        assertEquals(1, result.exitCode)
        assertEquals("Error: Cannot parse palette response.", result.output)
        assertFalse(fileSystem.exists("/repo/.sdds/tenants/palette.json"))
        assertFalse(fileSystem.exists("/repo/.sdds/tenants/sdds_cs/meta.json"))
        assertEquals(originalConfig, fileSystem.readText("/repo/.sdds/config.json"))
        assertFalse(result.output.contains("secret-value"))
    }

    @Test
    fun themeFetchWritesLocalFilesAndConfigTenants() {
        val fileSystem = initializedFileSystem()
        fileSystem.writeText("/repo/.sdds/sdds_cs/web/web_spacing.json", """{"stale":"value"}""")
        fileSystem.writeText("/repo/.sdds/stale_tenant/meta.json", """[{"stale":"tenant"}]""")
        ProjectConfigStore(fileSystem).updateTenants(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(
                configTenant("stale-tenant").copy(
                    name = "Stale Tenant",
                    directoryPath = ".sdds/stale_tenant",
                ),
            ),
        )
        val calls = mutableListOf<String>()
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = successfulThemeHttpResults(),
            onGet = { calls += it },
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))
        val config = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))
        val meta = Json.parseToJsonElement(fileSystem.readText("/repo/.sdds/tenants/sdds_cs/meta.json")).jsonObject
        val tokens = meta.getValue("tokens").jsonArray
        val typographyToken = tokens
            .single { it.jsonObject.getValue("id").jsonPrimitive.content == "typography-token" }
            .jsonObject
        val androidTypography = fileSystem.readText("/repo/.sdds/tenants/sdds_cs/android/android_typography.json")
        val iosColor = fileSystem.readText("/repo/.sdds/tenants/sdds_cs/ios/ios_color.json")
        val webColor = fileSystem.readText("/repo/.sdds/tenants/sdds_cs/web/web_color.json")

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Status: themes fetched"))
        assertEquals("tenant-a", config.tenants.single().id)
        assertEquals(".sdds/tenants/sdds_cs", config.tenants.single().directoryPath)
        assertEquals(".sdds/tenants/palette.json", config.palettePath)
        assertPaletteWritten(fileSystem)
        assertEquals("SDDS CS", meta.getValue("name").jsonPrimitive.content)
        assertEquals("latest", meta.getValue("version").jsonPrimitive.content)
        assertEquals(3, tokens.size)
        assertEquals("screen-s.header.h2.normal", typographyToken.getValue("name").jsonPrimitive.content)
        assertEquals(
            listOf("screen-s", "header", "h2", "normal"),
            typographyToken.getValue("tags").jsonArray.map { it.jsonPrimitive.content },
        )
        assertTrue(androidTypography.contains("fontSize"))
        assertTrue(iosColor.contains("#FFFFFF"))
        assertTrue(webColor.contains("#FFFFFF"))
        assertFalse(fileSystem.exists("/repo/.sdds/sdds_cs/web/web_spacing.json"))
        assertFalse(fileSystem.exists("/repo/.sdds/stale_tenant/meta.json"))
        assertFalse(fileSystem.readText("/repo/.sdds/config.json").contains("secret-value"))
        assertFalse(fileSystem.readText("/repo/.sdds/config.json").contains("apiUrl"))
        assertThemeFetchCalls(calls)
    }

    private fun assertThemeFetchCalls(calls: List<String>) {
        assertEquals(
            listOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants",
                "/api/projects/project-a/ds/design-systems/design-system-a/tokens",
                "/api/projects/project-a/ds/palette",
                "/api/projects/project-a/ds/tenants/tenant-a/token-values",
            ),
            calls,
        )
    }

    @Test
    fun themeFetchPreservesAliasForExistingTenantAndRemovesMissingTenantAlias() {
        val fileSystem = initializedFileSystem()
        ProjectConfigStore(fileSystem).updateTenants(
            configPath = "/repo/.sdds/config.json",
            tenants = listOf(
                configTenant("tenant-a").copy(alias = "main"),
                configTenant("removed-tenant").copy(alias = "removed"),
            ),
        )
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = successfulThemeHttpResults(),
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))
        val updated = ProjectConfigCodec().decode(fileSystem.readText("/repo/.sdds/config.json"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals("main", updated.tenants.single { it.id == "tenant-a" }.alias)
        assertFalse(updated.tenants.any { it.id == "removed-tenant" })
        assertFalse(fileSystem.readText("/repo/.sdds/config.json").contains("secret-value"))
        assertFalse(fileSystem.readText("/repo/.sdds/config.json").contains("apiUrl"))
    }

    @Test
    fun themeFetchTreatsBlankTokenValuesResponseAsEmptyListWhenTokensAreEmpty() {
        val fileSystem = initializedFileSystem()
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
            httpResults = mapOf(
                "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to
                    AuthenticatedHttpResult.Success(tenantsResponse()),
                "/api/projects/project-a/ds/design-systems/design-system-a/tokens" to
                    AuthenticatedHttpResult.Success("[]"),
                "/api/projects/project-a/ds/palette" to AuthenticatedHttpResult.Success(paletteResponse()),
                "/api/projects/project-a/ds/tenants/tenant-a/token-values" to
                    AuthenticatedHttpResult.Success(""),
            ),
        )

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Status: themes fetched"))
        val meta = Json.parseToJsonElement(fileSystem.readText("/repo/.sdds/tenants/sdds_cs/meta.json")).jsonObject

        assertEquals(0, meta.getValue("tokens").jsonArray.size)
        assertEquals("SDDS CS", meta.getValue("name").jsonPrimitive.content)
        assertEquals("latest", meta.getValue("version").jsonPrimitive.content)
    }

    @Test
    fun themeFetchMapsBackendAndCredentialFailuresWithoutSecret() {
        val backendFailure = DsBuilderCli(
            fakeRuntime(
                fileSystem = initializedFileSystem(),
                environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                httpResult = AuthenticatedHttpResult.Failure(
                    "Status: forbidden. API key has no access to this project.",
                ),
            ),
        ).execute(listOf("theme", "fetch"))
        val credentialMissing = DsBuilderCli(
            fakeRuntime(fileSystem = initializedFileSystem()),
        ).execute(listOf("theme", "fetch"))

        assertEquals(1, backendFailure.exitCode)
        assertEquals("Status: forbidden. API key has no access to this project.", backendFailure.output)
        assertFalse(backendFailure.output.contains("secret-value"))
        assertEquals(1, credentialMissing.exitCode)
        assertTrue(credentialMissing.output.contains("DSBUILDER_PROJECT_A_API_KEY"))
    }

    private fun assertPaletteWritten(fileSystem: FakeFileSystem) {
        val palette = Json.parseToJsonElement(fileSystem.readText("/repo/.sdds/tenants/palette.json")).jsonObject

        assertEquals("#DFF2FF", palette.getValue("blue").jsonObject.getValue("100").jsonPrimitive.content)
        assertEquals("#F8F8F8", palette.getValue("gray").jsonObject.getValue("50").jsonPrimitive.content)
    }

    private fun projectConfig(projectId: String = "project-a"): ProjectConfig = ProjectConfig(
        projectId = projectId,
        designSystemId = "design-system-a",
        credential = CredentialReference(
            type = CredentialReferenceType.ENV,
            name = "DSBUILDER_PROJECT_A_API_KEY",
        ),
    )

    private fun configTenant(id: String): ProjectConfigTenant = ProjectConfigTenant(
        id = id,
        designSystemId = "design-system-a",
        name = "SDDS CS",
        description = "Tenant",
        directoryPath = ".sdds/tenants/sdds_cs",
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun tenant(
        id: String = "tenant-a",
        name: String = "SDDS CS",
    ): Tenant = Tenant(
        id = id,
        designSystemId = "design-system-a",
        name = name,
        description = "Tenant",
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun token(
        id: String,
        name: String,
        type: String,
        enabled: Boolean = true,
    ): Token = Token(
        id = id,
        designSystemId = "design-system-a",
        name = name,
        type = type,
        displayName = name,
        description = "Token",
        enabled = enabled,
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun tokenValue(
        tokenId: String,
        platform: Platform = Platform.WEB,
        mode: String = "light",
        value: List<JsonElement> = listOf(JsonPrimitive("#FFFFFF")),
    ): TokenValue = TokenValue(
        id = "value-$tokenId-${platform.directoryName}-$mode",
        tokenId = tokenId,
        tenantId = "tenant-a",
        paletteId = "palette-a",
        platform = platform,
        mode = mode,
        value = value,
        createdAt = "2026-06-04T07:37:55.526Z",
        updatedAt = "2026-06-04T07:37:55.526Z",
    )

    private fun paletteItem(
        shade: String,
        saturation: Int,
        value: String,
    ): PaletteItem = PaletteItem(
        id = "palette-$shade-$saturation",
        type = "general",
        shade = shade,
        saturation = saturation,
        value = value,
        createdAt = "2026-03-25T10:26:34.485Z",
        updatedAt = "2026-04-09T08:25:46.365Z",
    )

    private fun jsonObject(vararg values: Pair<String, String>): JsonObject = JsonObject(
        values.associate { (key, value) -> key to JsonPrimitive(value) },
    )

    private fun successfulThemeHttpResults(): Map<String, AuthenticatedHttpResult> = mapOf(
        "/api/projects/project-a/ds/design-systems/design-system-a/tenants" to AuthenticatedHttpResult.Success(
            tenantsResponse(),
        ),
        "/api/projects/project-a/ds/design-systems/design-system-a/tokens" to AuthenticatedHttpResult.Success(
            tokensResponse(),
        ),
        "/api/projects/project-a/ds/palette" to AuthenticatedHttpResult.Success(
            paletteResponse(),
        ),
        "/api/projects/project-a/ds/tenants/tenant-a/token-values" to AuthenticatedHttpResult.Success(
            tokenValuesResponse(),
        ),
    )

    private fun tenantsResponse(): String = Json.encodeToString(
        ListSerializer(ProjectConfigTenant.serializer()),
        listOf(configTenant("tenant-a")),
    )

    private fun tokensResponse(): String =
        """
            [
              {
                "id": "typography-token",
                "designSystemId": "design-system-a",
                "name": "screen-s.header.h2.normal",
                "type": "typography",
                "displayName": "Header",
                "description": "Header typography",
                "enabled": true,
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              },
              {
                "id": "ios-color-token",
                "designSystemId": "design-system-a",
                "name": "color.ios.primary",
                "type": "color",
                "displayName": "iOS primary",
                "description": "iOS primary color",
                "enabled": true,
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              },
              {
                "id": "web-color-token",
                "designSystemId": "design-system-a",
                "name": "color.web.primary",
                "type": "color",
                "displayName": "Web primary",
                "description": "Web primary color",
                "enabled": true,
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              }
            ]
        """.trimIndent()

    private fun singleColorTokenResponse(): String =
        """
            [
              {
                "id": "color-token",
                "designSystemId": "design-system-a",
                "name": "color.primary",
                "type": "color",
                "displayName": "Primary",
                "description": "Primary color",
                "enabled": true,
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              }
            ]
        """.trimIndent()

    private fun nullableAndNonNullColorValuesResponse(): String =
        """
            [
              {
                "id": "value-color-null",
                "tokenId": "color-token",
                "tenantId": "tenant-a",
                "paletteId": null,
                "platform": "web",
                "mode": null,
                "value": null,
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              },
              {
                "id": "value-color",
                "tokenId": "color-token",
                "tenantId": "tenant-a",
                "paletteId": null,
                "platform": "web",
                "mode": "light",
                "value": ["#171717F5"],
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              }
            ]
        """.trimIndent()

    private fun paletteResponse(): String =
        """
            [
              {
                "id": "palette-blue-100-a",
                "type": "general",
                "shade": "blue",
                "saturation": 100,
                "value": "#EDF8FF",
                "createdAt": "2026-03-25T10:26:34.485Z",
                "updatedAt": "2026-04-09T08:25:46.365Z"
              },
              {
                "id": "palette-gray-50",
                "type": "general",
                "shade": "gray",
                "saturation": 50,
                "value": "#F8F8F8",
                "createdAt": "2026-03-25T10:26:34.485Z",
                "updatedAt": "2026-04-09T08:25:46.365Z"
              },
              {
                "id": "palette-blue-100-b",
                "type": "general",
                "shade": "blue",
                "saturation": 100,
                "value": "#DFF2FF",
                "createdAt": "2026-03-25T10:26:34.485Z",
                "updatedAt": "2026-04-09T08:25:46.365Z"
              }
            ]
        """.trimIndent()

    private fun tokenValuesResponse(): String =
        """
            [
              {
                "id": "value-typography",
                "tokenId": "typography-token",
                "tenantId": "tenant-a",
                "paletteId": "palette-a",
                "platform": "android",
                "mode": null,
                "value": [{"fontSize": "16"}],
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              },
              {
                "id": "value-ios-color",
                "tokenId": "ios-color-token",
                "tenantId": "tenant-a",
                "paletteId": "palette-a",
                "platform": "ios",
                "mode": "light",
                "value": ["#FFFFFF"],
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              },
              {
                "id": "value-web-color",
                "tokenId": "web-color-token",
                "tenantId": "tenant-a",
                "paletteId": "palette-a",
                "platform": "web",
                "mode": "light",
                "value": ["#FFFFFF"],
                "createdAt": "2026-06-04T07:37:55.526Z",
                "updatedAt": "2026-06-04T07:37:55.526Z"
              }
            ]
        """.trimIndent()

    private fun initializedFileSystem(): FakeFileSystem {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo/src")
        fileSystem.writeText("/repo/.sdds/config.json", ProjectConfigCodec().encode(projectConfig()))
        return fileSystem
    }

    private fun fakeRuntime(
        fileSystem: FakeFileSystem = FakeFileSystem(currentDirectory = "/repo"),
        environment: Map<String, String> = emptyMap(),
        httpResult: AuthenticatedHttpResult = AuthenticatedHttpResult.Success("""{"name":"default"}"""),
        httpResults: Map<String, AuthenticatedHttpResult> = emptyMap(),
        onGet: (String) -> Unit = { _ -> },
        multipartResponse: AuthenticatedHttpResponse = AuthenticatedHttpResponse(503, ""),
        onPost: (String, MultipartFile) -> Unit = { _, _ -> },
        onCreate: (String, String) -> Unit = { _, _ -> },
    ): CliRuntime = CliRuntime(
        fileSystem = fileSystem,
        environmentReader = EnvironmentReader { name -> environment[name] },
        httpClientFactory = FakeAuthenticatedHttpClientFactory(
            httpResult,
            httpResults,
            onGet,
            multipartResponse,
            onPost,
            onCreate,
        ),
    )
}

private class FakeAuthenticatedHttpClientFactory(
    private val result: AuthenticatedHttpResult,
    private val results: Map<String, AuthenticatedHttpResult>,
    private val onGet: (String) -> Unit,
    private val multipartResponse: AuthenticatedHttpResponse,
    private val onPost: (String, MultipartFile) -> Unit,
    private val onCreate: (String, String) -> Unit,
) : AuthenticatedHttpClientFactory {
    override fun create(
        apiUrl: String,
        apiKey: String,
    ): AuthenticatedHttpClient {
        onCreate(apiUrl, apiKey)
        return object : AuthenticatedHttpClient {
            override fun get(path: String): AuthenticatedHttpResult {
                onGet(path)
                return results[path] ?: result
            }

            override fun post(path: String, body: String): AuthenticatedHttpResult {
                onGet(path)
                return results[path] ?: result
            }

            override fun postMultipart(path: String, file: MultipartFile): AuthenticatedHttpResponse {
                onPost(path, file)
                return multipartResponse
            }
        }
    }
}

private class FakeFileSystem(
    private val currentDirectory: String,
) : CliFileSystem {
    private val files = mutableMapOf<String, ByteArray>()
    private val directories = mutableSetOf<String>()

    override fun currentWorkingDirectory(): String = normalize(currentDirectory)

    override fun parent(path: String): String? {
        val normalized = normalize(path)
        if (normalized == "/") {
            return null
        }
        return normalized.substringBeforeLast("/", missingDelimiterValue = "")
            .ifBlank { "/" }
            .takeUnless { it == normalized }
    }

    override fun resolve(parent: String, child: String): String = normalize("${normalize(parent).trimEnd('/')}/$child")

    override fun absolutePath(path: String): String = normalize(path)

    override fun exists(path: String): Boolean {
        val normalized = normalize(path)
        return files.containsKey(normalized) || directories.contains(normalized)
    }

    override fun isDirectory(path: String): Boolean {
        return directories.contains(normalize(path))
    }

    override fun createDirectories(path: String) {
        directories += normalize(path)
    }

    override fun listFiles(path: String): List<String> {
        val directory = normalize(path).trimEnd('/')
        val result = mutableListOf<String>()
        result.addAll(files.keys.filter { parent(it) == directory }.sorted())
        result.addAll(directories.filter { parent(it) == directory }.sorted())
        return result
    }

    override fun readText(path: String): String =
        files[normalize(path)]?.decodeToString() ?: error("Missing file: $path")

    override fun readBytes(path: String): ByteArray =
        files[normalize(path)] ?: error("Missing file: $path")

    override fun writeText(path: String, text: String) {
        val normalized = normalize(path)
        parent(normalized)?.let { directories += it }
        files[normalized] = text.encodeToByteArray()
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        val normalized = normalize(path)
        parent(normalized)?.let { directories += it }
        files[normalized] = bytes
    }

    override fun sink(path: String): okio.BufferedSink {
        val normalized = normalize(path)
        parent(normalized)?.let { directories += it }
        val buffer = okio.Buffer()
        return object : okio.Sink {
            override fun write(source: okio.Buffer, byteCount: Long) {
                buffer.write(source, byteCount)
            }

            override fun flush() {
                // Sink flush — no-op for in-memory buffer
            }

            override fun close() {
                files[normalized] = buffer.readByteArray()
            }

            override fun timeout() = okio.Timeout.NONE
        }.buffer()
    }

    override fun deleteFile(path: String) {
        files.remove(normalize(path))
    }

    private fun normalize(path: String): String {
        val parts = path.split("/")
            .filter { it.isNotBlank() && it != "." }
            .fold(mutableListOf<String>()) { accumulator, part ->
                if (part == "..") {
                    if (accumulator.isNotEmpty()) {
                        accumulator.removeAt(accumulator.lastIndex)
                    }
                } else {
                    accumulator += part
                }
                accumulator
            }
        return "/" + parts.joinToString("/")
    }
}
