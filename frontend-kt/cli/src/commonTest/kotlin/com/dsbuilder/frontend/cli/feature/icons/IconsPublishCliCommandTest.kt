package com.dsbuilder.frontend.cli.feature.icons

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
 * `icons publish` через настоящий DI-граф CLI: проверяется разбор аргументов и отказы до обращения к сети.
 * Сборка манифеста и отправка проверяются в тестах `feature-components`.
 */
class IconsPublishCliCommandTest {
    private val requests = mutableListOf<String>()

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
                override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
                    AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")

                override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> =
                    AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Unavailable")
            },
        ),
    ).execute(args)

    private val publish = listOf("icons", "publish")

    @Test
    fun theClientSecretCannotBeACommandLineArgument() {
        listOf(
            publish + listOf("--from-dir", "/icons", "--api-url", "http://backend", "--client-secret", "top-secret"),
            publish + listOf("--from-dir", "/icons", "--api-url", "http://backend", "--client-secret=top-secret"),
        ).forEach { args ->
            val result = run(args)

            assertEquals(1, result.exitCode, result.output)
            assertTrue(!result.output.contains("top-secret"), result.output)
        }
        assertTrue(requests.isEmpty())
    }

    @Test
    fun exactlyOneSourceIsRequired() {
        val none = run(publish + listOf("--api-url", "http://backend"))
        val both = run(
            publish + listOf("--from-dir", "/icons", "--from", "/m.json", "--api-url", "http://backend"),
        )

        listOf(none, both).forEach { result ->
            assertEquals(1, result.exitCode, result.output)
            assertTrue(result.output.contains("--from-dir") && result.output.contains("--from"), result.output)
        }
        assertTrue(requests.isEmpty())
    }

    @Test
    fun theApiUrlIsRequired() {
        val result = run(publish + listOf("--from-dir", "/icons"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("--api-url"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun writeManifestNeedsTheDirectorySource() {
        val result = run(
            publish + listOf("--from", "/m.json", "--write-manifest", "/o.json", "--api-url", "http://backend"),
        )

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("--write-manifest"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aMissingDirectoryNamesThePathAndSendsNothing() {
        val result = run(publish + listOf("--from-dir", "/icons", "--api-url", "http://backend"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("/icons"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun aMissingManifestNamesThePathAndSendsNothing() {
        val result = run(publish + listOf("--from", "/m.json", "--api-url", "http://backend"))

        assertEquals(1, result.exitCode, result.output)
        assertTrue(result.output.contains("/m.json"), result.output)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun theCommandIsListedAndDocumentsItsOptionsAndBothWaysToSignIn() {
        val group = run(listOf("icons", "--help"))
        val help = run(publish + "--help")

        assertEquals(0, group.exitCode, group.output)
        assertTrue(group.output.contains("publish"), group.output)
        assertEquals(0, help.exitCode, help.output)
        listOf(
            "--from-dir",
            "--from",
            "--api-url",
            "--package-version",
            "--write-manifest",
            "--allow-removing-used",
            "--apply",
            "DSBUILDER_CLIENT_ID",
            "DSBUILDER_CLIENT_SECRET",
        ).forEach { assertTrue(help.output.contains(it), "no '$it' in:\n${help.output}") }
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
