package com.dsbuilder.frontend.feature.docs.application

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSource
import com.dsbuilder.frontend.core.application.ContextSourceResult
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.auth.EnvironmentReader
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class DocsReadUseCasesTest {
    @Test
    fun configuredPlatformIsUsedWhenToolArgumentIsAbsent() = runTest {
        val remote = RecordingDocsReadRemoteSource()
        val useCases = useCases(listOf(TargetPlatform.COMPOSE), remote)

        useCases.search(DocumentationSearchCommand("Button", null, null, null, null, null))
        useCases.navigation(DocumentationPublicationCommand(null, null))
        useCases.page(DocumentationPageCommand("components/Button.md", null, null))
        useCases.searchBindings(CodeBindingSearchCommand(null, null, null, null, null, null, null))
        useCases.getBinding(CodeBindingGetCommand("binding", null, null, null))

        assertEquals(List<String?>(5) { "compose" }, remote.platforms)
    }

    @Test
    fun explicitDocumentationPlatformOverridesProjectConfig() = runTest {
        val remote = RecordingDocsReadRemoteSource()
        val useCases = useCases(listOf(TargetPlatform.COMPOSE), remote)

        useCases.navigation(DocumentationPublicationCommand(null, "design"))

        assertEquals(listOf<String?>("design"), remote.platforms)
    }

    @Test
    fun severalConfiguredPlatformsRequireExplicitToolArgument() = runTest {
        val remote = RecordingDocsReadRemoteSource()
        val useCases = useCases(listOf(TargetPlatform.COMPOSE, TargetPlatform.SWIFT_UI), remote)

        val result = useCases.navigation(DocumentationPublicationCommand(null, null))

        val failure = assertIs<DocsReadResult.Failed>(result)
        assertEquals(DocsReadErrorCode.AMBIGUOUS_CONTEXT, failure.code)
        assertTrue(failure.message.contains("compose") && failure.message.contains("swiftui"), failure.message)
        assertTrue(remote.platforms.isEmpty())
    }

    @Test
    fun bindingWithPublicationIdDoesNotRequirePlatform() = runTest {
        val remote = RecordingDocsReadRemoteSource()
        val useCases = useCases(emptyList(), remote)

        val result = useCases.getBinding(CodeBindingGetCommand("binding", "publication", null, null))

        assertIs<DocsReadResult.Success>(result)
        assertEquals(listOf<String?>(null), remote.platforms)
    }

    private fun useCases(
        platforms: List<TargetPlatform>,
        remote: DocsReadRemoteSource,
    ): DocsReadUseCases {
        val context = ProjectContext(
            projectId = ProjectId("project"),
            designSystemId = DesignSystemId("design-system"),
            credentialEnvName = CredentialEnvName("PROJECT_KEY"),
            configPath = "/workspace/.sdds/config.json",
            platforms = platforms,
        )
        return DocsReadUseCases(
            contextResolver = ContextResolver(listOf(ContextSource { ContextSourceResult.Found(context) })),
            apiUrlResolver = ApiUrlResolver(EnvironmentReader { null }),
            credentialProvider = object : CredentialProvider {
                override suspend fun resolve(
                    apiUrl: com.dsbuilder.frontend.core.domain.ProjectApiUrl,
                    projectKeyOverride: String?,
                    credentialEnvName: CredentialEnvName,
                ): CredentialResult = CredentialResult.Selected(
                    BackendCredential.ProjectKey("key"),
                    BackendCredentialType.PROJECT_KEY,
                )
            },
            remoteSource = remote,
        )
    }
}

private class RecordingDocsReadRemoteSource : DocsReadRemoteSource {
    val platforms = mutableListOf<String?>()

    override suspend fun search(
        runtime: DocsReadRuntime,
        command: DocumentationSearchCommand,
    ): DocsReadResult = success(command.platform)

    override suspend fun fetch(
        runtime: DocsReadRuntime,
        command: DocumentationFetchCommand,
    ): DocsReadResult = success(null)

    override suspend fun navigation(
        runtime: DocsReadRuntime,
        command: DocumentationPublicationCommand,
    ): DocsReadResult = success(command.platform)

    override suspend fun page(
        runtime: DocsReadRuntime,
        command: DocumentationPageCommand,
    ): DocsReadResult = success(command.platform)

    override suspend fun searchBindings(
        runtime: DocsReadRuntime,
        command: CodeBindingSearchCommand,
    ): DocsReadResult = success(command.platform)

    override suspend fun getBinding(
        runtime: DocsReadRuntime,
        command: CodeBindingGetCommand,
    ): DocsReadResult = success(command.platform)

    private fun success(platform: String?): DocsReadResult.Success {
        platforms += platform
        return DocsReadResult.Success(JsonObject(emptyMap()))
    }
}
