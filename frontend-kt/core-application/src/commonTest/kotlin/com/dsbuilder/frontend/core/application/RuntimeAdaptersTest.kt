package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.network.API_URL_ENV
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.workspace.CredentialReference
import com.dsbuilder.frontend.core.workspace.CredentialReferenceType
import com.dsbuilder.frontend.core.workspace.ProjectConfig
import com.dsbuilder.frontend.core.workspace.ProjectConfigCodec
import com.dsbuilder.frontend.core.workspace.ProjectConfigStore
import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
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

        val result = reader.requireContext()

        assertIs<ProjectContextReadResult.Found>(result)
        assertEquals("project-a", result.context.projectId.value)
        assertEquals("design-system-a", result.context.designSystemId.value)
        assertEquals("DSBUILDER_PROJECT_A_API_KEY", result.context.credentialEnvName.value)
        assertEquals("/repo/.sdds/config.json", result.context.configPath)
    }

    @Test
    fun projectContextReaderReturnsFailedWithErrorPrefixWhenConfigIsMissing() {
        val reader = LocalProjectContextReader(ProjectConfigStore(InMemoryFileSystem(currentDirectory = "/repo")))

        val result = reader.requireContext()

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
