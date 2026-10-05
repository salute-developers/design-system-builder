package com.dsbuilder.ds.tokens

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.tokens.application.CreatePaletteEntry
import com.dsbuilder.ds.tokens.application.CreatePaletteEntryUseCase
import com.dsbuilder.ds.tokens.application.CreateToken
import com.dsbuilder.ds.tokens.application.CreateTokenUseCase
import com.dsbuilder.ds.tokens.application.GetTokenUseCase
import com.dsbuilder.ds.tokens.application.GetTokenValuesUseCase
import com.dsbuilder.ds.tokens.application.ListTokensUseCase
import com.dsbuilder.ds.tokens.application.PaletteRepository
import com.dsbuilder.ds.tokens.application.TokenRepository
import com.dsbuilder.ds.tokens.application.TokenValueFilter
import com.dsbuilder.ds.tokens.application.UpdateToken
import com.dsbuilder.ds.tokens.domain.PaletteEntry
import com.dsbuilder.ds.tokens.domain.PaletteType
import com.dsbuilder.ds.tokens.domain.Token
import com.dsbuilder.ds.tokens.domain.TokenMode
import com.dsbuilder.ds.tokens.domain.TokenPlatform
import com.dsbuilder.ds.tokens.domain.TokenType
import com.dsbuilder.ds.tokens.domain.TokenValue
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class TokenUseCaseTest {
    private val evaluator = PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())
    private val policy = DsAccessPolicy(evaluator)
    private val transactions = ImmediateTransactions()

    @Test
    fun `list tokens passes trusted project to repository`() = runBlocking {
        val repository = RecordingTokenRepository()
        val result = ListTokensUseCase(policy, transactions, repository).execute(viewerContext())

        assertIs<DsResult.Success<List<Token>>>(result)
        assertEquals(ProjectId("project-1"), repository.listedProject)
    }

    @Test
    fun `palette mutation is forbidden for project owner`() = runBlocking {
        val result = CreatePaletteEntryUseCase(policy, transactions, UnusedPaletteRepository()).execute(
            ownerContext(),
            CreatePaletteEntry(PaletteType.GENERAL, "red", 50, "#ff0000"),
        )

        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(result).error)
    }

    @Test
    fun `missing token is represented as non-disclosing not found`() = runBlocking {
        val result = GetTokenUseCase(
            policy,
            transactions,
            RecordingTokenRepository(),
        ).execute(viewerContext(), UUID.randomUUID())

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(result).error)
    }

    @Test
    fun `create token forwards trusted project and values forward exact filter`() = runBlocking {
        val repository = RecordingTokenRepository()
        val command = CreateToken(UUID.randomUUID(), "button.color", TokenType.COLOR, null, null, true)
        val filter = TokenValueFilter(UUID.randomUUID(), TokenPlatform.WEB, TokenMode.DARK)

        val create = CreateTokenUseCase(policy, transactions, repository).execute(ownerContext(), command)
        val values = GetTokenValuesUseCase(
            policy,
            transactions,
            repository,
        ).execute(ownerContext(), UUID.randomUUID(), filter)

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(create).error)
        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(values).error)
        assertEquals(ProjectId("project-1"), repository.valuesProject)
        assertEquals(filter, repository.valuesFilter)
    }

    private fun viewerContext() = context("viewer")

    private fun ownerContext() = context("owner")

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    )

    private class ImmediateTransactions : TransactionRunner {
        override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
        override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
    }

    private class RecordingTokenRepository : TokenRepository {
        var listedProject: ProjectId? = null
        var valuesProject: ProjectId? = null
        var valuesFilter: TokenValueFilter? = null

        override suspend fun listAccessible(projectId: ProjectId): List<Token> {
            listedProject = projectId
            return emptyList()
        }

        override suspend fun findAccessible(projectId: ProjectId, id: UUID): Token? = null
        override suspend fun createOwned(projectId: ProjectId, command: CreateToken): Token? = null
        override suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateToken): Token? = null
        override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean = false
        override suspend fun values(projectId: ProjectId, id: UUID, filter: TokenValueFilter): List<TokenValue>? {
            valuesProject = projectId
            valuesFilter = filter
            return null
        }
    }

    private class UnusedPaletteRepository : PaletteRepository {
        override suspend fun list(): List<PaletteEntry> = error("not called")
        override suspend fun listByType(type: PaletteType): List<PaletteEntry> = error("not called")
        override suspend fun find(id: UUID): PaletteEntry? = error("not called")
        override suspend fun create(command: CreatePaletteEntry): PaletteEntry = error("not called")
        override suspend fun updateValue(id: UUID, value: String): PaletteEntry? = error("not called")
        override suspend fun delete(id: UUID): Boolean = error("not called")
    }
}
