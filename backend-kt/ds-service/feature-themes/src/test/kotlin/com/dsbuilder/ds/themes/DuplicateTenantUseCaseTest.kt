package com.dsbuilder.ds.themes

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.IdempotentRequestLookup
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.CreateTenant
import com.dsbuilder.ds.themes.application.DuplicateTenant
import com.dsbuilder.ds.themes.application.DuplicateTenantUseCase
import com.dsbuilder.ds.themes.application.SaveTenantTokenValues
import com.dsbuilder.ds.themes.application.TenantRepository
import com.dsbuilder.ds.themes.application.TenantTokenValueCopier
import com.dsbuilder.ds.themes.application.TenantTokenValuesSaveOutcome
import com.dsbuilder.ds.themes.application.UpdateTenant
import com.dsbuilder.ds.themes.application.palette.FakeTenantPaletteRepository
import com.dsbuilder.ds.themes.application.tokengroups.FakeTokenGroupRepository
import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.Tenant
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemePreview
import com.dsbuilder.ds.themes.domain.ThemeProfile
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import kotlinx.coroutines.runBlocking
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull

/** Права, принадлежность исходной темы, конфликт названия и порядок копирования в сценарии дублирования темы. */
class DuplicateTenantUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val designSystemId = UUID.randomUUID()
    private val source = theme(designSystemId, "Malachite", ColorConfiguration(profile = ThemeProfile.MALACHITE))

    @Test
    fun `copy gets the source profile and description, its values and palette`() = runBlocking {
        val repository = FakeTenants(source)
        val values = RecordingCopier()
        val palette = FakeTenantPaletteRepository(null)

        val result = useCase(repository, values, palette)
            .execute(context("editor"), DuplicateTenant(designSystemId, source.id, "Malachite копия"))

        val copy = assertIs<DsResult.Success<Tenant>>(result).value
        val command = requireNotNull(repository.created)
        assertEquals("Malachite копия", command.name)
        assertEquals(source.description, command.description)
        assertEquals(source.colorConfiguration, command.colorConfiguration)
        assertEquals(source.id to copy.id, values.copied)
        assertEquals(source.id to copy.id, palette.copied)
    }

    @Test
    fun `viewer cannot duplicate a theme`() = runBlocking {
        val repository = FakeTenants(source)

        val result = useCase(repository).execute(context("viewer"), DuplicateTenant(designSystemId, source.id, "Копия"))

        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(result).error)
        assertNull(repository.created)
    }

    @Test
    fun `theme of another design system is not found`() = runBlocking {
        val repository = FakeTenants(source)

        val result = useCase(repository)
            .execute(context("editor"), DuplicateTenant(UUID.randomUUID(), source.id, "Копия"))

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(result).error)
        assertNull(repository.created)
    }

    @Test
    fun `missing theme is not found`() = runBlocking {
        val repository = FakeTenants(source)

        val result = useCase(repository)
            .execute(context("editor"), DuplicateTenant(designSystemId, UUID.randomUUID(), "Копия"))

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(result).error)
    }

    @Test
    fun `taken name is a conflict and creates nothing`() = runBlocking {
        val repository = FakeTenants(source, takenName = "malachite")
        val values = RecordingCopier()

        val result = useCase(repository, values)
            .execute(context("editor"), DuplicateTenant(designSystemId, source.id, "Malachite"))

        assertEquals(DsFailure.Conflict("TENANT_NAME_CONFLICT"), assertIs<DsResult.Failure>(result).error)
        assertNull(repository.created)
        assertNull(values.copied)
    }

    @Test
    fun `blank name is rejected`() = runBlocking {
        val repository = FakeTenants(source)

        val result = useCase(repository).execute(context("editor"), DuplicateTenant(designSystemId, source.id, " "))

        assertEquals(DsFailure.InvalidRequest("invalid_body"), assertIs<DsResult.Failure>(result).error)
        assertNull(repository.created)
    }

    @Test
    fun `failed value copy escapes the transaction before the palette is copied`() = runBlocking {
        val palette = FakeTenantPaletteRepository(null)
        val failing = object : TenantTokenValueCopier {
            override suspend fun copy(source: Tenant, target: Tenant): Unit = error("write failed")
        }

        // Ошибка не превращается в успех: транзакция откатывает уже созданную тему.
        assertFailsWith<IllegalStateException> {
            useCase(FakeTenants(source), failing, palette)
                .execute(context("editor"), DuplicateTenant(designSystemId, source.id, "Копия"))
        }
        assertNull(palette.copied)
    }

    private fun useCase(
        repository: TenantRepository,
        values: TenantTokenValueCopier = RecordingCopier(),
        palette: FakeTenantPaletteRepository = FakeTenantPaletteRepository(null),
    ) = DuplicateTenantUseCase(
        policy,
        ImmediateTransactions(),
        repository,
        values,
        palette,
        IdempotentCreateExecutor(NewRequests()),
        NoLocks(),
        FakeTokenGroupRepository(designSystemId),
    )

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    )
}

private class RecordingCopier : TenantTokenValueCopier {
    var copied: Pair<UUID, UUID>? = null

    override suspend fun copy(source: Tenant, target: Tenant) {
        copied = source.id to target.id
    }
}

private class FakeTenants(private val source: Tenant, private val takenName: String? = null) : TenantRepository {
    var created: CreateTenant? = null
    private val themes = mutableMapOf(source.id to source)

    override suspend fun listAccessible(projectId: ProjectId): List<Tenant> = themes.values.toList()

    override suspend fun findAccessible(projectId: ProjectId, id: UUID): Tenant? = themes[id]

    override suspend fun nameExists(
        projectId: ProjectId,
        designSystemId: UUID,
        normalizedName: String,
        excludingId: UUID?,
    ): Boolean = normalizedName == takenName

    override suspend fun createOwned(projectId: ProjectId, command: CreateTenant): Tenant {
        created = command
        return theme(command.designSystemId, command.name, command.colorConfiguration).also { themes[it.id] = it }
    }

    override suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateTenant): Tenant? = null

    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean = false

    override suspend fun tokenValues(
        projectId: ProjectId,
        id: UUID,
        types: Set<ThemeTokenType>,
    ): List<TenantTokenValue>? = null

    override suspend fun saveTokenValues(
        projectId: ProjectId,
        id: UUID,
        command: SaveTenantTokenValues,
    ): TenantTokenValuesSaveOutcome = TenantTokenValuesSaveOutcome.NotFound
}

private class NewRequests : IdempotentRequestRepository {
    override suspend fun lookup(
        projectId: ProjectId,
        key: String,
        operation: String,
        requestHash: String,
    ): IdempotentRequestLookup = IdempotentRequestLookup.New

    override suspend fun save(
        projectId: ProjectId,
        key: String,
        actorId: String,
        operation: String,
        requestHash: String,
        response: IdempotentResponse,
    ) = Unit
}

private class NoLocks : UniqueKeyLockRepository {
    override suspend fun lock(designSystemId: UUID, entityType: String, normalizedKey: String) = Unit
}

private fun theme(designSystemId: UUID, name: String?, configuration: ColorConfiguration) = Tenant(
    id = UUID.randomUUID(),
    designSystemId = designSystemId,
    name = name,
    description = "Описание",
    colorConfiguration = configuration,
    editRevision = 0,
    preview = ThemePreview("#2563EB", "#FFFFFF", "#F6F8FC", "#60A5FA", "#111827"),
    createdAt = Instant.EPOCH,
    updatedAt = Instant.EPOCH,
)
