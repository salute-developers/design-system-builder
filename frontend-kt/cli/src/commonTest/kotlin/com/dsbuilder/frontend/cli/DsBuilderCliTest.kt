package com.dsbuilder.frontend.cli

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
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResponse
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.MultipartFile
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import com.dsbuilder.frontend.core.workspace.CredentialReference
import com.dsbuilder.frontend.core.workspace.CredentialReferenceType
import com.dsbuilder.frontend.core.workspace.ProjectConfig
import com.dsbuilder.frontend.core.workspace.ProjectConfigCodec
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.ProjectConfigTenant
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okio.Buffer
import okio.Sink
import okio.buffer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DsBuilderCliTest {
    @Test
    fun statusUsesProjectEnvForKeyAndApiUrl() {
        val fileSystem = initializedFileSystem()
        fileSystem.writeText(
            "/repo/.env",
            "DSBUILDER_PROJECT_A_API_KEY=project-secret\nDSBUILDER_API_URL=https://project.test",
        )
        val selected = mutableListOf<BackendCredential>()
        val urls = mutableListOf<String>()
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                onCredential = { selected += it },
                onCreate = { url, _ -> urls += url },
            ),
        ).execute(listOf("status"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(selected.all { it == BackendCredential.ProjectKey("project-secret") })
        assertTrue(urls.all { it == "https://project.test" })
        assertFalse(result.output.contains("project-secret"))
    }

    @Test
    fun statusProcessEnvWinsOverProjectEnv() {
        val fileSystem = initializedFileSystem()
        fileSystem.writeText(
            "/repo/.env",
            "DSBUILDER_PROJECT_A_API_KEY=project-secret\nDSBUILDER_API_URL=https://project.test",
        )
        val selected = mutableListOf<BackendCredential>()
        val urls = mutableListOf<String>()
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                environment = mapOf(
                    "DSBUILDER_PROJECT_A_API_KEY" to "process-secret",
                    "DSBUILDER_API_URL" to "https://process.test",
                ),
                onCredential = { selected += it },
                onCreate = { url, _ -> urls += url },
            ),
        ).execute(listOf("status"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(selected.all { it == BackendCredential.ProjectKey("process-secret") })
        assertTrue(urls.all { it == "https://process.test" })
        assertFalse(result.output.contains("process-secret"))
    }

    @Test
    fun statusWithoutProjectContextExplainsLinkAfterLogin() {
        val runtime = fakeRuntime(
            credentialStore = testSessionStore(),
            tokenClient = testTokenClient(),
        )

        val result = DsBuilderCli(runtime).execute(listOf("status"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("--design-system"), result.output)
        assertTrue(result.output.contains("dsbuilder init"), result.output)
        assertFalse(result.output.contains("authentication is required"), result.output)
    }

    @Test
    fun explicitLinkSelectsHeadlessStatusWithUserSession() {
        val selected = mutableListOf<BackendCredential>()
        val runtime = fakeRuntime(
            credentialStore = testSessionStore(),
            tokenClient = testTokenClient(),
            httpResults = mapOf(
                "/api/projects/project-b" to AuthenticatedHttpResult.Success(
                    """{"id":"project-b","name":"Other project"}""",
                ),
                "/api/projects/project-b/ds/design-systems/ds-b" to AuthenticatedHttpResult.Success(
                    """{"id":"internal-b","designSystemId":"ds-b","name":"Other DS"}""",
                ),
            ),
            onCredential = { selected += it },
        )
        val link = "dsbuilder://projects/project-b/design-systems/ds-b?version=2.0&platform=compose"

        val result = DsBuilderCli(runtime).execute(listOf("status", "--design-system", link))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Project: Other project"))
        assertTrue(selected.all { it == BackendCredential.Bearer("access-token") })
    }

    @Test
    fun explicitLinkCanSelectHeadlessProjectKeyEnvironment() {
        val selected = mutableListOf<BackendCredential>()
        val runtime = fakeRuntime(
            environment = mapOf("CI_PROJECT_KEY" to "ci-secret"),
            httpResults = mapOf(
                "/api/projects/project-b" to AuthenticatedHttpResult.Success(
                    """{"id":"project-b","name":"Other project"}""",
                ),
                "/api/projects/project-b/ds/design-systems/ds-b" to AuthenticatedHttpResult.Success(
                    """{"id":"internal-b","designSystemId":"ds-b","name":"Other DS"}""",
                ),
            ),
            onCredential = { selected += it },
        )
        val link = "dsbuilder://projects/project-b/design-systems/ds-b?version=2.0&platform=compose"

        val result = DsBuilderCli(runtime).execute(
            listOf("status", "--design-system", link, "--project-key-env", "CI_PROJECT_KEY"),
        )

        assertEquals(0, result.exitCode, result.output)
        assertTrue(selected.all { it == BackendCredential.ProjectKey("ci-secret") })
        assertFalse(result.output.contains("ci-secret"))
    }

    @Test
    fun projectScopedHelpListsExplicitContextOptions() {
        val cli = DsBuilderCli(fakeRuntime())
        listOf(
            listOf("status"),
            listOf("docs", "publish"),
            listOf("theme", "fetch"),
            listOf("components", "push"),
            listOf("components", "fetch"),
        ).forEach { command ->
            val result = cli.execute(command + "--help")
            assertEquals(0, result.exitCode, result.output)
            assertTrue(result.output.contains("--design-system"), result.output)
            assertTrue(result.output.contains("--project-key-env"), result.output)
        }
    }

    @Test
    fun userSessionCanFetchThemeAndPublishDocsWithoutProjectKey() {
        val fileSystem = initializedFileSystem().apply {
            writeText(
                "/repo/.sdds/config.json",
                ProjectConfigCodec().encode(
                    projectConfig().copy(credential = CredentialReference(CredentialReferenceType.USER_SESSION)),
                ),
            )
            writeBytes("/.sdds/temp/docs-bundle.tar.gz", byteArrayOf(1))
        }
        val selected = mutableListOf<BackendCredential>()
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "ignored-key"),
            httpResults = successfulThemeHttpResults(),
            multipartResponse = AuthenticatedHttpResponse(200, """{"bundleId":"bundle-a","jobId":"job-a"}"""),
            credentialStore = testSessionStore(),
            tokenClient = testTokenClient(),
            onCredential = { selected += it },
        )

        val theme = DsBuilderCli(runtime).execute(listOf("theme", "fetch"))
        val docs = DsBuilderCli(runtime).execute(listOf("docs", "publish"))

        assertEquals(0, theme.exitCode, theme.output)
        assertEquals(0, docs.exitCode, docs.output)
        assertTrue(selected.isNotEmpty())
        assertTrue(selected.all { it == BackendCredential.Bearer("access-token") })
    }

    @Test
    fun defaultInvocationReturnsHelpText() {
        val result = DsBuilderCli(fakeRuntime()).execute(emptyList())

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Usage: dsbuilder"))
        assertTrue(result.output.contains("init"))
        assertTrue(result.output.contains("auth"))
        assertTrue(result.output.contains("status"))
        assertTrue(result.output.contains("theme"))
        assertTrue(result.output.contains("mcp"))
    }

    @Test
    fun authHelpDoesNotRequireProjectContextOrBackend() {
        val result = DsBuilderCli(fakeRuntime()).execute(listOf("auth", "--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("login"), result.output)
        assertTrue(result.output.contains("status"), result.output)
        assertTrue(result.output.contains("logout"), result.output)
    }

    @Test
    fun authLoginRejectsPasswordArgumentBeforeParsing() {
        val result = DsBuilderCli(fakeRuntime()).execute(
            listOf("auth", "login", "--username", "alice", "--password", "secret"),
        )

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("password must be entered interactively"), result.output)
        assertFalse(result.output.contains("secret"), result.output)
    }

    @Test
    fun mcpServeHelpDoesNotRequireProjectContextOrBackend() {
        val result = DsBuilderCli(fakeRuntime()).execute(listOf("mcp", "serve", "--help"))

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Serve DS Builder MCP tools over stdio."), result.output)
        assertTrue(result.output.contains("--workspace"), result.output)
        assertTrue(result.output.contains("--api-url"), result.output)
    }

    @Test
    fun versionInvocationReturnsVersionText() {
        val result = DsBuilderCli(fakeRuntime()).execute(listOf("--version"))

        assertEquals(0, result.exitCode)
        assertEquals("dsbuilder version 0.1.0", result.output)
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
    fun docsPublishRejectsMissingProjectContextAndCredentialBeforeRequest() {
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
        assertTrue(missingContext.output.contains("--design-system"))
        assertEquals(1, missingKey.exitCode)
        assertTrue(missingKey.output.contains("authentication is required"))
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
        fileSystem.writeText("/repo/.sdds/component-configs.json", "existing snapshot")
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
        assertEquals("existing snapshot", fileSystem.readText("/repo/.sdds/component-configs.json"))
    }

    @Test
    fun componentsFetchReplacesComponentConfigsWithOriginalResponseAndEmptyArray() {
        val fileSystem = initializedFileSystem()
        val path = "/repo/.sdds/component-configs.json"
        val endpoint = "/api/projects/project-a/ds/legacy/design-systems/SDDS%20CS/component-configs"
        fileSystem.writeText(path, "old configs")
        for (body in listOf("[ { \"name\": \"Button\", \"extra\": [true, null, 1] } ]", "[]")) {
            val result = DsBuilderCli(
                fakeRuntime(
                    fileSystem = fileSystem,
                    environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                    httpResults = successfulComponentHttpResults() +
                        (endpoint to AuthenticatedHttpResult.Success(body)),
                ),
            ).execute(listOf("components", "fetch", "--to", "/custom-components"))

            assertEquals(0, result.exitCode, result.output)
            assertEquals(body, fileSystem.readText(path))
            assertTrue(result.output.contains("Component configs: /repo/.sdds/component-configs.json"))
            assertFalse(fileSystem.exists("/repo/src/.sdds/component-configs.json"))
            assertTrue(fileSystem.exists("/custom-components/meta.json"))
            assertFalse(fileSystem.exists("/repo/.sdds/tenants/palette.json"))
        }
    }

    @Test
    fun componentsFetchPreservesLocalFilesWhenSnapshotDownloadFails() {
        val configsEndpoint = "/api/projects/project-a/ds/legacy/design-systems/SDDS%20CS/component-configs"
        val failures = listOf(
            configsEndpoint to AuthenticatedHttpResult.Failure("Error: unavailable"),
            configsEndpoint to AuthenticatedHttpResult.Success("{\"apiKey\":\"secret-value\"}"),
            configsEndpoint to AuthenticatedHttpResult.Success("[broken JSON"),
        )
        for (failure in failures) {
            val fileSystem = initializedFileSystem()
            val originalConfig = fileSystem.readText("/repo/.sdds/config.json")
            fileSystem.writeText("/repo/.sdds/component-configs.json", "old configs")
            fileSystem.writeText("/repo/.sdds/tenants/sdds_cs/meta.json", "old theme")
            val result = DsBuilderCli(
                fakeRuntime(
                    fileSystem = fileSystem,
                    environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                    httpResults = successfulComponentHttpResults() + failure,
                ),
            ).execute(listOf("components", "fetch"))

            assertEquals(1, result.exitCode, failure.toString())
            assertEquals("old configs", fileSystem.readText("/repo/.sdds/component-configs.json"))
            assertFalse(fileSystem.exists("/repo/.sdds/components/meta.json"))
            assertEquals("old theme", fileSystem.readText("/repo/.sdds/tenants/sdds_cs/meta.json"))
            assertEquals(originalConfig, fileSystem.readText("/repo/.sdds/config.json"))
            assertFalse(fileSystem.exists("/repo/.sdds/tenants/palette.json"))
            assertFalse(result.output.contains("secret-value"))
        }
    }

    @Test
    fun componentsFetchEncodesDesignSystemNameAndUsesRuntimeOverrides() {
        val calls = mutableListOf<String>()
        val configsPath = "/api/projects/project-a/ds/legacy/design-systems/SDDS%2FCS%3F%23%25/component-configs"
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = initializedFileSystem(),
                httpResults = successfulComponentHttpResults() + mapOf(
                    "/api/projects/project-a/ds/component-config/export" to
                        AuthenticatedHttpResult.Success(
                            """{"meta":{"name":"SDDS/CS?#%","version":"latest"},"components":[]}""",
                        ),
                    configsPath to AuthenticatedHttpResult.Success("[]"),
                ),
                onGet = { calls += it },
                onCreate = { url, key ->
                    assertEquals("https://api.example.com", url)
                    assertEquals("override-key", key)
                },
            ),
        ).execute(listOf("components", "fetch", "--api-url", "https://api.example.com", "--api-key", "override-key"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals(listOf("/api/projects/project-a/ds/component-config/export", configsPath), calls)
    }

    @Test
    fun componentsFetchReportsComponentFileWriteFailure() {
        val fileSystem = initializedFileSystem()
        fileSystem.writeFailurePath = "/repo/.sdds/component-configs.json"
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                httpResults = successfulComponentHttpResults(),
            ),
        ).execute(listOf("components", "fetch"))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("Cannot write component configs"))
        assertFalse(result.output.contains("Written to:"))
    }

    @Test
    fun componentsFetchSavesSnapshotWhenComponentsShareDefaultStyle() {
        val fileSystem = initializedFileSystem()
        val response = """
            {"meta":{"name":"qwe","version":"0.1.0"},"components":[
              {"componentName":"accordion","styleName":"default","config":{}},
              {"componentName":"badge","styleName":"default","config":{}},
              {"componentName":"button","styleName":"default","config":{}}
            ]}
        """.trimIndent()
        val snapshot = """[{"name":"button","config":{"custom":true}}]"""
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                environment = mapOf("DSBUILDER_PROJECT_A_API_KEY" to "secret-value"),
                httpResults = mapOf(
                    "/api/projects/project-a/ds/component-config/export" to AuthenticatedHttpResult.Success(response),
                    "/api/projects/project-a/ds/legacy/design-systems/qwe/component-configs" to
                        AuthenticatedHttpResult.Success(snapshot),
                ),
            ),
        ).execute(listOf("components", "fetch"))

        assertEquals(0, result.exitCode, result.output)
        assertEquals(snapshot, fileSystem.readText("/repo/.sdds/component-configs.json"))
        for (component in listOf("accordion", "badge", "button")) {
            assertTrue(fileSystem.exists("/repo/.sdds/components/${component}_default_config.json"))
        }
    }

    private fun successfulComponentHttpResults(): Map<String, AuthenticatedHttpResult> = mapOf(
        "/api/projects/project-a/ds/component-config/export" to AuthenticatedHttpResult.Success(
            """{"meta":{"name":"SDDS CS","version":"latest"},"components":[]}""",
        ),
        "/api/projects/project-a/ds/legacy/design-systems/SDDS%20CS/component-configs" to
            AuthenticatedHttpResult.Success("[]"),
    )

    @Test
    fun headlessComponentsFetchWritesSnapshotToExplicitDestination() {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo")
        val credentials = mutableListOf<BackendCredential>()
        val link = "dsbuilder://projects/project-a/design-systems/design-system-a?version=1.0&platform=compose"
        val result = DsBuilderCli(
            fakeRuntime(
                fileSystem = fileSystem,
                environment = mapOf("CI_PROJECT_KEY" to "ci-secret"),
                httpResults = successfulComponentHttpResults(),
                onCredential = { credentials += it },
            ),
        ).execute(
            listOf(
                "components", "fetch", "--design-system", link,
                "--project-key-env", "CI_PROJECT_KEY", "--to", "/target/components",
                "--api-url", "https://api.example.com",
            ),
        )

        assertEquals(0, result.exitCode, result.output)
        assertTrue(fileSystem.exists("/target/components/meta.json"))
        assertEquals("[]", fileSystem.readText("/target/components/component-configs.json"))
        assertFalse(fileSystem.exists("/repo/.sdds/config.json"))
        assertEquals(2, credentials.size)
        assertTrue(credentials.all { it == BackendCredential.ProjectKey("ci-secret") })
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
    fun themeFetchWithLinkWritesToExplicitDestinationWithoutLocalConfig() {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo")
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            credentialStore = testSessionStore(),
            tokenClient = testTokenClient(),
            httpResults = successfulThemeHttpResults(),
        )
        val link = "dsbuilder://projects/project-a/design-systems/design-system-a?version=1.0.0&platform=compose"

        val result = DsBuilderCli(runtime).execute(
            listOf("theme", "fetch", "--design-system", link, "--destination", "/target"),
        )

        assertEquals(0, result.exitCode, result.output)
        assertTrue(result.output.contains("Config: /target/.sdds/config.json"), result.output)
        val config = ProjectConfigCodec().decode(fileSystem.readText("/target/.sdds/config.json"))
        assertEquals("project-a", config.projectId)
        assertEquals("design-system-a", config.designSystemId)
        assertEquals(CredentialReferenceType.USER_SESSION, config.credential.type)
        assertEquals(listOf("compose"), config.platforms)
        assertTrue(fileSystem.exists("/target/.sdds/tenants/palette.json"))
        assertFalse(fileSystem.exists("/repo/.sdds/config.json"))
    }

    @Test
    fun themeFetchWithLinkRequiresDestinationBeforeBackendCall() {
        val calls = mutableListOf<String>()
        val runtime = fakeRuntime(onGet = { calls += it })
        val link = "dsbuilder://projects/project-a/design-systems/design-system-a?version=1.0.0&platform=compose"

        val result = DsBuilderCli(runtime).execute(listOf("theme", "fetch", "--design-system", link))

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("--destination"), result.output)
        assertTrue(calls.isEmpty())
    }

    @Test
    fun themeFetchDoesNotOverwriteDestinationConfig() {
        val fileSystem = FakeFileSystem(currentDirectory = "/repo")
        val existingConfig = ProjectConfigCodec().encode(projectConfig())
        fileSystem.writeText("/target/.sdds/config.json", existingConfig)
        val runtime = fakeRuntime(
            fileSystem = fileSystem,
            credentialStore = testSessionStore(),
            tokenClient = testTokenClient(),
            httpResults = successfulThemeHttpResults(),
        )
        val link = "dsbuilder://projects/project-a/design-systems/design-system-a?version=1.0.0&platform=compose"

        val result = DsBuilderCli(runtime).execute(
            listOf("theme", "fetch", "--design-system", link, "--destination", "/target"),
        )

        assertEquals(1, result.exitCode)
        assertTrue(result.output.contains("already exists"), result.output)
        assertEquals(existingConfig, fileSystem.readText("/target/.sdds/config.json"))
        assertFalse(fileSystem.exists("/target/.sdds/tenants/palette.json"))
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
        assertTrue(credentialMissing.output.contains("authentication is required"))
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
        credentialStore: CredentialStore? = null,
        tokenClient: TokenClient? = null,
        onCredential: (BackendCredential) -> Unit = {},
    ): ClientRuntime = ClientRuntime(
        fileSystem = fileSystem,
        environmentReader = EnvironmentReader { name -> environment[name] },
        httpClientFactory = FakeAuthenticatedHttpClientFactory(
            httpResult,
            httpResults,
            onGet,
            multipartResponse,
            onPost,
            onCreate,
            onCredential,
        ),
        processRunner = ProcessRunner { ProcessResult(exitCode = 0, output = "") },
    ).let { runtime ->
        runtime.copy(
            credentialStore = credentialStore ?: runtime.credentialStore,
            tokenClient = tokenClient ?: runtime.tokenClient,
        )
    }

    private fun testSessionStore(): CredentialStore = object : CredentialStore {
        override suspend fun read(apiUrl: String): UserSession = UserSession(
            schemaVersion = 1,
            apiUrl = apiUrl,
            username = "user@example.com",
            refreshToken = "refresh-token",
            refreshExpiresAt = 999,
            updatedAt = 1,
        )
        override suspend fun save(session: UserSession) = Unit
        override suspend fun delete(apiUrl: String) = Unit
    }

    private fun testTokenClient(): TokenClient = object : TokenClient {
        override suspend fun login(apiUrl: String, username: String, password: String): AuthResult<TokenResponse> =
            AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")
        override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
            AuthResult.Success(TokenResponse("access-token", "refresh-token", 999))
        override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> =
            AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")
    }
}

private class FakeAuthenticatedHttpClientFactory(
    private val result: AuthenticatedHttpResult,
    private val results: Map<String, AuthenticatedHttpResult>,
    private val onGet: (String) -> Unit,
    private val multipartResponse: AuthenticatedHttpResponse,
    private val onPost: (String, MultipartFile) -> Unit,
    private val onCreate: (String, String) -> Unit,
    private val onCredential: (BackendCredential) -> Unit,
) : AuthenticatedHttpClientFactory {
    override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient {
        onCredential(credential)
        return when (credential) {
            is BackendCredential.ProjectKey -> create(apiUrl, credential.value)
            is BackendCredential.Bearer -> create(apiUrl, "")
        }
    }
    override fun create(
        apiUrl: String,
        apiKey: String,
    ): AuthenticatedHttpClient {
        onCreate(apiUrl, apiKey)
        return object : AuthenticatedHttpClient {
            override suspend fun get(path: String): AuthenticatedHttpResult {
                onGet(path)
                return results[path] ?: result
            }

            override suspend fun post(path: String, body: String): AuthenticatedHttpResult {
                onGet(path)
                return results[path] ?: result
            }

            override suspend fun postMultipart(path: String, file: MultipartFile): AuthenticatedHttpResponse {
                onPost(path, file)
                return multipartResponse
            }
        }
    }
}

private class FakeFileSystem(
    private val currentDirectory: String,
) : WorkspaceFileSystem {
    private val files = mutableMapOf<String, ByteArray>()
    private val directories = mutableSetOf<String>()
    var writeFailurePath: String? = null

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
        check(path != writeFailurePath) { "Cannot write $path" }
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
