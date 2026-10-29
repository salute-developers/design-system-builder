package com.dsbuilder.frontend.feature.projects.application

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.RefreshTokenStore
import com.dsbuilder.frontend.core.auth.UserOAuthTokens
import com.dsbuilder.frontend.core.auth.UserSessionCredentialResolver
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

private class NoOpRefreshTokenStore : RefreshTokenStore {
    override fun save(refreshToken: String) = Unit

    override fun load(): String? = null

    override fun clear() = Unit
}

private class FakeProjectsClient(
    private val result: ProjectsReadResult,
) : ProjectsClient {
    var lastApiUrl: String? = null
    var lastCredential: BackendCredential? = null

    override suspend fun listProjects(apiUrl: String, credential: BackendCredential): ProjectsReadResult {
        lastApiUrl = apiUrl
        lastCredential = credential
        return result
    }
}

class ListProjectsUseCaseTest {
    private val apiUrlResolver = ApiUrlResolver { null }

    private fun sessionWithAccessToken(token: String): UserSessionCredentialResolver {
        val resolver = UserSessionCredentialResolver(NoOpRefreshTokenStore())
        resolver.applyTokens(UserOAuthTokens(token, "refresh", 300))
        return resolver
    }

    @Test
    fun returnsProjectsFromThePort() = runTest {
        val projects = listOf(Project(id = "p1", name = "Project One", description = null))
        val client = FakeProjectsClient(ProjectsReadResult.Success(projects))
        val useCase = ListProjectsUseCase(apiUrlResolver, sessionWithAccessToken("access-a"), client)

        val result = useCase.execute()

        assertIs<ProjectsReadResult.Success>(result)
        assertEquals(projects, result.projects)
        assertEquals(BackendCredential.Bearer("access-a"), client.lastCredential)
    }

    @Test
    fun emptyListIsNotAnError() = runTest {
        val client = FakeProjectsClient(ProjectsReadResult.Success(emptyList()))
        val useCase = ListProjectsUseCase(apiUrlResolver, sessionWithAccessToken("access-a"), client)

        val result = useCase.execute()

        assertIs<ProjectsReadResult.Success>(result)
        assertEquals(emptyList(), result.projects)
    }

    @Test
    fun missingSessionReturnsAuthRequiredWithoutCallingClient() = runTest {
        val client = FakeProjectsClient(ProjectsReadResult.Success(emptyList()))
        val emptySession = UserSessionCredentialResolver(NoOpRefreshTokenStore())
        val useCase = ListProjectsUseCase(apiUrlResolver, emptySession, client)

        val result = useCase.execute()

        assertIs<ProjectsReadResult.Failed>(result)
        assertEquals(ProjectsReadErrorCode.AUTH_REQUIRED, result.code)
        assertEquals(null, client.lastApiUrl)
    }
}
