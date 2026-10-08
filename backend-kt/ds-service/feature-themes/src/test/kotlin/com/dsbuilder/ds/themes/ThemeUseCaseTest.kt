package com.dsbuilder.ds.themes

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DesignSystemComponentInitializer
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.CreateTenant
import com.dsbuilder.ds.themes.application.CreateTenantUseCase
import com.dsbuilder.ds.themes.application.GetTenantUseCase
import com.dsbuilder.ds.themes.application.SaveTenantTokenValues
import com.dsbuilder.ds.themes.application.SaveTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.TenantRepository
import com.dsbuilder.ds.themes.application.TenantTokenValueInitializer
import com.dsbuilder.ds.themes.application.TenantTokenValuesSaveOutcome
import com.dsbuilder.ds.themes.application.UpdateTenant
import com.dsbuilder.ds.themes.application.UpdateTenantUseCase
import com.dsbuilder.ds.themes.application.palette.FakeTenantPaletteRepository
import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.Tenant
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput
import com.dsbuilder.ds.themes.domain.ThemePreview
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Tests authorization, ownership propagation and missing-resource behavior of theme use cases. */
class ThemeUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()

    @Test
    fun `get tenant maps an inaccessible resource to not found`() = runBlocking {
        val result = GetTenantUseCase(
            policy,
            transactions,
            RecordingTenantRepository(),
        ).execute(ownerContext(), UUID.randomUUID())

        assertEquals(DsFailure.NotFound, assertIs<DsResult.Failure>(result).error)
    }

    @Test
    fun `create tenant passes trusted project to owned repository operation`() = runBlocking {
        val repository = RecordingTenantRepository()
        val command = CreateTenant(UUID.randomUUID(), "dark", null, ColorConfiguration())

        val componentInitializer = RecordingComponentInitializer()
        val initializer = RecordingTokenValueInitializer()
        val palette = FakeTenantPaletteRepository(null)
        val result = CreateTenantUseCase(
            policy,
            transactions,
            repository,
            componentInitializer,
            initializer,
            palette,
        ).execute(ownerContext(), command)

        assertIs<DsResult.Success<Tenant>>(result)
        assertEquals(ProjectId("project-1"), repository.createProject)
        assertEquals(command, repository.createCommand)
        assertEquals(command.designSystemId, componentInitializer.designSystemId)
        assertEquals(command.designSystemId, initializer.tenant?.designSystemId)
        assertEquals(initializer.tenant?.id, palette.initializedTenant)
    }

    @Test
    fun `update tenant requires write permission before repository access`() = runBlocking {
        val repository = RecordingTenantRepository()
        val result = UpdateTenantUseCase(policy, transactions, repository).execute(
            viewerContext(),
            UUID.randomUUID(),
            UpdateTenant(null, false, null, false, null, false),
        )

        assertEquals(DsFailure.Forbidden, assertIs<DsResult.Failure>(result).error)
        assertEquals(null, repository.updateProject)
    }

    @Test
    fun `batch save rejects duplicate token platform and mode before a transaction`() = runBlocking {
        val repository = RecordingTenantRepository()
        val input = TenantTokenValueInput(
            UUID.randomUUID(),
            ThemeTokenPlatform.WEB,
            ThemeTokenMode.LIGHT,
            null,
            JsonPrimitive("#ffffff"),
        )

        val result = SaveTenantTokenValuesUseCase(policy, transactions, repository).execute(
            ownerContext(),
            UUID.randomUUID(),
            SaveTenantTokenValues(0, listOf(input, input)),
        )

        assertEquals(DsFailure.InvalidRequest("invalid_body"), assertIs<DsResult.Failure>(result).error)
        assertEquals(null, repository.saveProject)
    }

    @Test
    fun `batch save exposes the current edit revision on a conflict`() = runBlocking {
        val repository = RecordingTenantRepository().apply {
            saveOutcome = TenantTokenValuesSaveOutcome.RevisionConflict(7)
        }

        val result = SaveTenantTokenValuesUseCase(policy, transactions, repository).execute(
            ownerContext(),
            UUID.randomUUID(),
            SaveTenantTokenValues(5, emptyList()),
        )

        assertEquals(
            DsFailure.Conflict("TENANT_EDIT_CONFLICT", editRevision = 7),
            assertIs<DsResult.Failure>(result).error,
        )
        assertEquals(ProjectId("project-1"), repository.saveProject)
    }

    private fun ownerContext() = context("owner")

    private fun viewerContext() = context("viewer")

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    )
}

private class RecordingTenantRepository : TenantRepository {
    var createProject: ProjectId? = null
    var createCommand: CreateTenant? = null
    var updateProject: ProjectId? = null
    var saveProject: ProjectId? = null
    var saveOutcome: TenantTokenValuesSaveOutcome = TenantTokenValuesSaveOutcome.NotFound

    override suspend fun listAccessible(projectId: ProjectId): List<Tenant> = emptyList()

    override suspend fun findAccessible(projectId: ProjectId, id: UUID): Tenant? = null

    override suspend fun createOwned(projectId: ProjectId, command: CreateTenant): Tenant {
        createProject = projectId
        createCommand = command
        return tenant(command.designSystemId)
    }

    override suspend fun updateOwned(projectId: ProjectId, id: UUID, command: UpdateTenant): Tenant? {
        updateProject = projectId
        return tenant(UUID.randomUUID())
    }

    override suspend fun deleteOwned(projectId: ProjectId, id: UUID): Boolean = false

    override suspend fun tokenValues(projectId: ProjectId, id: UUID): List<TenantTokenValue>? = null

    override suspend fun saveTokenValues(
        projectId: ProjectId,
        id: UUID,
        command: com.dsbuilder.ds.themes.application.SaveTenantTokenValues,
    ): TenantTokenValuesSaveOutcome {
        saveProject = projectId
        return saveOutcome
    }
}

private class RecordingTokenValueInitializer : TenantTokenValueInitializer {
    var tenant: Tenant? = null

    override suspend fun initialize(tenant: Tenant) {
        this.tenant = tenant
    }
}

private class RecordingComponentInitializer : DesignSystemComponentInitializer {
    var designSystemId: UUID? = null

    override suspend fun initialize(designSystemId: UUID) {
        this.designSystemId = designSystemId
    }
}

private fun tenant(designSystemId: UUID) = Tenant(
    id = UUID.randomUUID(),
    designSystemId = designSystemId,
    name = "dark",
    description = null,
    colorConfiguration = ColorConfiguration(),
    editRevision = 0,
    preview = ThemePreview("#2563EB", "#FFFFFF", "#F6F8FC", "#60A5FA", "#111827"),
    createdAt = Instant.EPOCH,
    updatedAt = Instant.EPOCH,
)
