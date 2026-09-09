package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.CredentialStore
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.auth.RotatingCredentialStore
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import com.dsbuilder.frontend.core.auth.UserSession
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.network.API_URL_ENV
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.workspace.CredentialReference
import com.dsbuilder.frontend.core.workspace.CredentialReferenceType
import com.dsbuilder.frontend.core.workspace.ProjectConfig
import com.dsbuilder.frontend.core.workspace.ProjectConfigCodec
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import kotlinx.coroutines.test.runTest
import okio.BufferedSink
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * Characterization-тесты на текущее поведение [LocalProjectContextReader] и
 * [RuntimeProjectApiUrlProvider]: перенесены при выносе `core.data.*` в отдельный
 * Gradle-модуль `core-application` (ADR-0004).
 */
class RuntimeAdaptersTest {
    @Test
    fun projectContextReaderReturnsFoundWhenConfigExists() {
        val fileSystem = InMemoryFileSystem(currentDirectory = "/repo")
        fileSystem.files["/repo/.sdds/config.json"] = ProjectConfigCodec().encode(
            ProjectConfig(
                projectId = "project-a",
                designSystemId = "design-system-a",
                credential = CredentialReference(
                    type = CredentialReferenceType.ENV,
                    name = "DSBUILDER_PROJECT_A_API_KEY",
                ),
            ),
        )
        val reader = LocalProjectContextReader(ProjectConfigStore(fileSystem))

        val result = reader.requireContext(null)

        assertIs<ProjectContextReadResult.Found>(result)
        assertEquals("project-a", result.context.projectId.value)
        assertEquals("design-system-a", result.context.designSystemId.value)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", result.context.credentialEnvName.value)
        assertEquals("/repo/.sdds/config.json", result.context.configPath)
    }

    @Test
    fun projectContextReaderReturnsFailedWithErrorPrefixWhenConfigIsMissing() {
        val reader = LocalProjectContextReader(ProjectConfigStore(InMemoryFileSystem(currentDirectory = "/repo")))

        val result = reader.requireContext(null)

        assertIs<ProjectContextReadResult.Failed>(result)
        assertEquals(
            "Error: Project is not initialized. Run `dsbuilder init --project-id <id> --design-system-id <id>`.",
            result.message,
        )
    }

    @Test
    fun apiUrlProviderDelegatesToResolverAndWrapsValue() {
        val provider: ProjectApiUrlProvider = RuntimeProjectApiUrlProvider(
            ApiUrlResolver(EnvironmentReader { name -> "http://env-host".takeIf { name == API_URL_ENV } }),
        )

        val result = provider.resolve(override = null)

        assertEquals("http://env-host", result.value)
    }

    @Test
    fun credentialProviderPrefersProjectKeyWithoutReadingSession() = runTest {
        var sessionRead = false
        val provider = RuntimeCredentialProvider(
            apiKeyResolver = com.dsbuilder.frontend.core.auth.ApiKeyResolver(
                EnvironmentReader { name -> "project-secret".takeIf { name == "DSBUILDER_API_KEY" } },
            ),
            credentialStore = object : CredentialStore {
                override suspend fun read(apiUrl: String): UserSession? {
                    sessionRead = true
                    return null
                }

                override suspend fun save(session: UserSession) = Unit

                override suspend fun delete(apiUrl: String) = Unit
            },
            tokenClient = NoopTokenClient,
        )

        val result = provider.resolve(
            ProjectApiUrl("https://api.example.com"),
            null,
            CredentialEnvName("DSBUILDER_API_KEY"),
        )

        val selected = assertIs<CredentialResult.Selected>(result)
        assertEquals(BackendCredential.ProjectKey("project-secret"), selected.credential)
        assertEquals(BackendCredentialType.PROJECT_KEY, selected.type)
        assertEquals(false, sessionRead)
    }

    @Test
    fun credentialProviderFallsBackToUserSessionWhenProjectKeyIsMissing() = runTest {
        val saved = mutableListOf<UserSession>()
        val provider = RuntimeCredentialProvider(
            apiKeyResolver = com.dsbuilder.frontend.core.auth.ApiKeyResolver(EnvironmentReader { null }),
            credentialStore = object : CredentialStore {
                override suspend fun read(apiUrl: String): UserSession = UserSession(
                    schemaVersion = 1,
                    apiUrl = apiUrl,
                    username = "user@example.com",
                    refreshToken = "refresh-old",
                    refreshExpiresAt = 100,
                    updatedAt = 1,
                )

                override suspend fun save(session: UserSession) {
                    saved += session
                }

                override suspend fun delete(apiUrl: String) = Unit
            },
            tokenClient = object : TokenClient {
                override suspend fun login(
                    apiUrl: String,
                    username: String,
                    password: String,
                ): AuthResult<TokenResponse> = AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "not configured")

                override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
                    AuthResult.Success(TokenResponse("access-new", "refresh-new", 200))

                override suspend fun logout(
                    apiUrl: String,
                    refreshToken: String,
                ): AuthResult<Unit> = AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "not configured")
            },
        )

        val result = provider.resolve(ProjectApiUrl("https://api.example.com"), null, CredentialEnvName("PROJECT_KEY"))

        val selected = assertIs<CredentialResult.Selected>(result)
        assertEquals(BackendCredential.Bearer("access-new"), selected.credential)
        assertEquals(BackendCredentialType.USER_SESSION, selected.type)
        assertEquals("refresh-new", saved.single().refreshToken)
    }

    @Test
    fun credentialProviderRefreshesUsingLockedSessionRereadWhenStoreSupportsRotation() = runTest {
        val store = object : RotatingCredentialStore {
            override suspend fun read(apiUrl: String): UserSession = session(apiUrl, "refresh-stale")

            override suspend fun save(session: UserSession) = Unit

            override suspend fun delete(apiUrl: String) = Unit

            override suspend fun refreshSession(
                apiUrl: String,
                refresh: suspend (UserSession) -> AuthResult<TokenResponse>,
            ): AuthResult<TokenResponse> = refresh(session(apiUrl, "refresh-current"))
        }
        var refreshTokenUsed: String? = null
        val provider = RuntimeCredentialProvider(
            apiKeyResolver = com.dsbuilder.frontend.core.auth.ApiKeyResolver(EnvironmentReader { null }),
            credentialStore = store,
            tokenClient = object : TokenClient by NoopTokenClient {
                override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> {
                    refreshTokenUsed = refreshToken
                    return AuthResult.Success(TokenResponse("access-new", "refresh-new", 200))
                }
            },
        )

        val result = provider.resolve(ProjectApiUrl("https://api.example.com"), null, CredentialEnvName("PROJECT_KEY"))

        assertEquals("refresh-current", refreshTokenUsed)
        assertEquals(BackendCredential.Bearer("access-new"), assertIs<CredentialResult.Selected>(result).credential)
    }

    @Test
    fun credentialProviderDeletesSessionAfterAuthRequiredRefreshFailureOnly() = runTest {
        val store = DeletingCredentialStore()
        val provider = RuntimeCredentialProvider(
            apiKeyResolver = com.dsbuilder.frontend.core.auth.ApiKeyResolver(EnvironmentReader { null }),
            credentialStore = store,
            tokenClient = object : TokenClient by NoopTokenClient {
                override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
                    AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Log in again.")
            },
        )

        val result = provider.resolve(ProjectApiUrl("https://api.example.com"), null, CredentialEnvName("PROJECT_KEY"))

        assertEquals(AuthErrorCode.AUTH_REQUIRED, assertIs<CredentialResult.Failed>(result).code)
        assertEquals(listOf("https://api.example.com"), store.deleted)
    }

    @Test
    fun credentialProviderKeepsSessionAfterTransportRefreshFailure() = runTest {
        val store = DeletingCredentialStore()
        val provider = RuntimeCredentialProvider(
            apiKeyResolver = com.dsbuilder.frontend.core.auth.ApiKeyResolver(EnvironmentReader { null }),
            credentialStore = store,
            tokenClient = object : TokenClient by NoopTokenClient {
                override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
                    AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Backend unavailable.")
            },
        )

        val result = provider.resolve(ProjectApiUrl("https://api.example.com"), null, CredentialEnvName("PROJECT_KEY"))

        assertEquals(AuthErrorCode.BACKEND_UNAVAILABLE, assertIs<CredentialResult.Failed>(result).code)
        assertEquals(emptyList(), store.deleted)
    }

    @Test
    fun contextResolverUsesFirstSourceThatFindsContext() {
        val expected = com.dsbuilder.frontend.core.domain.ProjectContext(
            projectId = com.dsbuilder.frontend.core.domain.ProjectId("project-a"),
            designSystemId = com.dsbuilder.frontend.core.domain.DesignSystemId("ds-a"),
            credentialEnvName = CredentialEnvName("PROJECT_KEY"),
            configPath = "/repo/.sdds/config.json",
        )
        val resolver = ContextResolver(
            listOf(
                ContextSource { ContextSourceResult.NotFound },
                ContextSource { ContextSourceResult.Found(expected) },
            ),
        )

        val result = resolver.resolve("/repo")

        assertEquals(expected, assertIs<ProjectContextReadResult.Found>(result).context)
    }

    private fun session(apiUrl: String, refreshToken: String): UserSession = UserSession(
        schemaVersion = 1,
        apiUrl = apiUrl,
        username = "user@example.com",
        refreshToken = refreshToken,
        refreshExpiresAt = 100,
        updatedAt = 1,
    )
}

private object NoopTokenClient : TokenClient {
    override suspend fun login(
        apiUrl: String,
        username: String,
        password: String,
    ): AuthResult<TokenResponse> = AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "not configured")

    override suspend fun refresh(
        apiUrl: String,
        refreshToken: String,
    ): AuthResult<TokenResponse> = AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "not configured")

    override suspend fun logout(
        apiUrl: String,
        refreshToken: String,
    ): AuthResult<Unit> = AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "not configured")
}

private class DeletingCredentialStore : CredentialStore {
    val deleted = mutableListOf<String>()

    override suspend fun read(apiUrl: String): UserSession = UserSession(
        schemaVersion = 1,
        apiUrl = apiUrl,
        username = "user@example.com",
        refreshToken = "refresh-old",
        refreshExpiresAt = 100,
        updatedAt = 1,
    )

    override suspend fun save(session: UserSession) = Unit

    override suspend fun delete(apiUrl: String) {
        deleted += apiUrl
    }
}

private class InMemoryFileSystem(
    private val currentDirectory: String,
) : WorkspaceFileSystem {
    val files: MutableMap<String, String> = mutableMapOf()

    override fun currentWorkingDirectory(): String = currentDirectory

    override fun parent(path: String): String? = path.trimEnd('/').substringBeforeLast('/').ifEmpty { null }

    override fun resolve(parent: String, child: String): String =
        if (child.startsWith("/")) child else "${parent.trimEnd('/')}/$child"

    override fun absolutePath(path: String): String = path

    override fun exists(path: String): Boolean = path in files

    override fun createDirectories(path: String) = Unit

    override fun listFiles(path: String): List<String> = files.keys.filter { parent(it) == path.trimEnd('/') }

    override fun isDirectory(path: String): Boolean = false

    override fun readText(path: String): String = files.getValue(path)

    override fun writeText(path: String, text: String) {
        files[path] = text
    }

    override fun readBytes(path: String): ByteArray = error("не используется")

    override fun writeBytes(path: String, bytes: ByteArray): Unit = error("не используется")

    override fun sink(path: String): BufferedSink = error("не используется")

    override fun deleteFile(path: String) {
        files.remove(path)
    }
}
