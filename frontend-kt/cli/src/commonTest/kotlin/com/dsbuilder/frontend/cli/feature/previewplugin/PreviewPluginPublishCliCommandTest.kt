package com.dsbuilder.frontend.cli.feature.previewplugin

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
 * `preview-plugin publish` через настоящий DI-граф CLI: проверяется разбор аргументов, отказы до обращения
 * к сети и обращение с секретом служебной учётки. Разбор настоящего zip проверяется в `jvmTest`
 * `feature-components` и сквозной публикацией на локальном контуре.
 */
class PreviewPluginPublishCliCommandTest {
    private val requests = mutableListOf<String>()

    private fun base(
        platform: String = "compose",
        from: String = "/work/preview-compose-plugin.zip",
        apiUrl: String? = "http://backend",
    ): List<String> = buildList {
        addAll(listOf("preview-plugin", "publish", "--platform", platform, "--from", from))
        apiUrl?.let { addAll(listOf("--api-url", it)) }
    }

    private fun run(args: List<String>, env: Map<String, String> = emptyMap()) = DsBuilderCli(
        ClientRuntime(
            fileSystem = EmptyFileSystem(),
            environmentReader = EnvironmentReader { name -> env[name] },
            httpClientFactory = RecordingFactory(requests),
            credentialStore = object : CredentialStore {
                override suspend fun read(apiUrl: String): UserSession? = null

                override suspend fun save(session: UserSession) = Unit

                override suspend fun delete(apiUrl: String) = Unit
            },
            tokenClient = object : TokenClient {
                override suspend fun login(apiUrl: String, username: String, password: String) =
                    AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")

                override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
                    AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")

                override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> =
                    AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")
            },
        ),
    ).execute(args)

    @Test
    fun theClientSecretCannotBeACommandLineArgument() {
        listOf(
            base() + listOf("--client-secret", "top-secret"),
            base() + "--client-secret=top-secret",
        ).forEach { args ->
            val result = run(args)

            assertEquals(1, result.exitCode, result.output)
            assertTrue(result.output.contains("DSBUILDER_CLIENT_SECRET"), result.output)
            assertTrue(!result.output.contains("top-secret"), result.output)
        }
        assertTrue(requests.isEmpty())
    }

    @Test
    fun platformAndFromAreRequired() {
        val withoutFrom =
            run(listOf("preview-plugin", "publish", "--platform", "compose", "--api-url", "http://backend"))
        val withoutPlatform =
            run(listOf("preview-plugin", "publish", "--from", "/work/p.zip", "--api-url", "http://backend"))

        assertEquals(1, withoutFrom.exitCode, withoutFrom.output)
        assertTrue(withoutFrom.output.contains("--from"), withoutFrom.output)
        assertEquals(1, withoutPlatform.exitCode, withoutPlatform.output)
        assertTrue(withoutPlatform.output.contains("--platform"), withoutPlatform.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun onlyComposeIsSupported() {
        val result = run(base(platform = "react"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("compose"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun withoutAnExplicitApiUrlNothingIsSent() {
        val result = run(base(apiUrl = null))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("--api-url"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aMissingArchiveNamesThePathAndSendsNothing() {
        val result = run(base(from = "/work/missing.zip"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("/work/missing.zip"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun theCommandIsListedAndDocumentsBothWaysToSignIn() {
        val group = run(listOf("preview-plugin", "--help"))
        val publish = run(listOf("preview-plugin", "publish", "--help"))

        assertEquals(0, group.exitCode, group.output)
        assertTrue(group.output.contains("publish"), group.output)
        assertEquals(0, publish.exitCode, publish.output)
        listOf("--platform", "--from", "--api-url", "--apply", "DSBUILDER_CLIENT_ID", "DSBUILDER_CLIENT_SECRET")
            .forEach { assertTrue(publish.output.contains(it), "no '$it' in:\n${publish.output}") }
    }

    private class RecordingFactory(private val requests: MutableList<String>) : AuthenticatedHttpClientFactory {
        override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient = client()

        override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient = client()

        private fun client() = object : AuthenticatedHttpClient {
            override suspend fun get(path: String): AuthenticatedHttpResult {
                requests += path
                return AuthenticatedHttpResult.Failure("unexpected")
            }

            override suspend fun post(path: String, body: String): AuthenticatedHttpResult {
                requests += path
                return AuthenticatedHttpResult.Failure("unexpected")
            }
        }
    }

    /** Файловая система без файлов: архив не найден, цель команды проверяется отказами до сети. */
    private class EmptyFileSystem : WorkspaceFileSystem {
        override fun currentWorkingDirectory(): String = "/work"

        override fun parent(path: String): String? = path.substringBeforeLast('/', "").ifEmpty { null }

        override fun resolve(parent: String, child: String): String = "${parent.trimEnd('/')}/$child"

        override fun absolutePath(path: String): String = if (path.startsWith("/")) path else "/work/$path"

        override fun exists(path: String): Boolean = false

        override fun createDirectories(path: String) = Unit

        override fun listFiles(path: String): List<String> = emptyList()

        override fun isDirectory(path: String): Boolean = false

        override fun readText(path: String): String = error("no files")

        override fun readBytes(path: String): ByteArray = error("no files")

        override fun writeText(path: String, text: String) = error("read-only")

        override fun writeBytes(path: String, bytes: ByteArray) = error("read-only")

        override fun sink(path: String): BufferedSink = error("read-only")

        override fun deleteFile(path: String) = Unit
    }
}
