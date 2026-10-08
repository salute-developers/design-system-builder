package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.ImmediateTransactions
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.palette.PaletteAnchor
import com.dsbuilder.ds.themes.domain.palette.PaletteGoldenTest
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.RemoveRampStrategy
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** Use case палитры темы: права, ревизия, запись, превью без записи и переписывание ссылок при удалении растяжки. */
class TenantPaletteUseCaseTest {
    private val golden = PaletteGoldenTest()
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()
    private val tenantId = UUID.randomUUID()
    private val green = PaletteRampRef(ThemePaletteType.GENERAL, "green")
    private val accentGreen = TenantPaletteRampTarget("g-accent", green)
    private val repository = FakeTenantPaletteRepository(
        TenantPaletteSnapshot(golden.scenarioState(), golden.scenarioTokens(), golden.scenarioValues()),
    )
    private val mutator = TenantPaletteMutator(policy, transactions, repository)
    private val revision = golden.scenarioState().editRevision
    private val owner = context("owner")

    @Test
    fun `чтение отдаёт право правки по роли и 404 для недоступной темы`() = runBlocking {
        val read = GetTenantPaletteUseCase(policy, transactions, repository)
        assertEquals(true, success(read.execute(owner, tenantId)).canEdit)
        assertEquals(false, success(read.execute(context("viewer"), tenantId)).canEdit)

        val links = ListTenantPaletteLinksUseCase(read).execute(context("viewer"), tenantId, green, "g-accent", 400)
        assertEquals(listOf("t1"), success(links).map { it.tokenId })

        repository.snapshot = null
        assertEquals(DsFailure.NotFound, failure(read.execute(owner, tenantId)))
    }

    @Test
    fun `изменение требует права записи и актуальной ревизии`() = runBlocking {
        val create = CreateTenantPaletteGroupUseCase(mutator) { UUID.fromString(NEW_GROUP_ID) }
        assertEquals(DsFailure.Forbidden, failure(create.execute(context("viewer"), tenantId, "Icons", revision)))

        val stale = conflict(create.execute(owner, tenantId, "Icons", revision - 1))
        assertEquals("TENANT_EDIT_CONFLICT", stale.code)
        assertEquals(revision, stale.editRevision)
        assertNull(repository.saved)

        val created = success(create.execute(owner, tenantId, "Icons", revision))
        assertEquals(revision + 1, created.editRevision)
        assertEquals(NEW_GROUP_ID, created.value.id)
        assertEquals(revision + 1, repository.saved?.editRevision)

        val duplicate = conflict(create.execute(owner, tenantId, "icons", revision + 1))
        assertEquals(PaletteOperations.GROUP_EXISTS, duplicate.code)
    }

    @Test
    fun `превью перестройки не пишет палитру`() = runBlocking {
        val anchor = PaletteAnchor(500, "#1F8A70")
        val preview = PreviewTenantPaletteRampRebuildUseCase(
            mutator,
        ).execute(owner, tenantId, accentGreen, anchor, revision)
        assertNull(repository.saved)

        val applied =
            success(RebuildTenantPaletteRampUseCase(mutator).execute(owner, tenantId, accentGreen, anchor, revision))
        assertEquals(success(preview), applied.value.steps.map { it.step to it.value })
        assertEquals("rebuild", applied.value.origin.wireValue)
        assertEquals(revision + 1, applied.editRevision)

        val invalid = PreviewTenantPaletteRampRebuildUseCase(mutator)
            .execute(owner, tenantId, accentGreen, PaletteAnchor(500, "nope"), revision + 1)
        assertEquals("invalid_body", assertIs<DsFailure.InvalidRequest>(failure(invalid)).code)
    }

    @Test
    fun `удаление растяжки переписывает ссылки токенов группы`() = runBlocking {
        val remove = RemoveTenantPaletteRampUseCase(mutator, repository)
        val linked = conflict(remove.execute(owner, tenantId, accentGreen, null, null, revision))
        assertEquals(PaletteOperations.RAMP_LINKED, linked.code)

        val accentSteps = golden.scenarioPalette().ramp("g-accent", green)!!.steps
        val detach = RemoveRampStrategy.DETACH
        val removed = success(remove.execute(owner, tenantId, accentGreen, detach, null, revision))
        assertEquals(2, removed.value.reassigned)
        assertEquals(listOf("t1"), assertNotNull(repository.rewrite).tokenIds)
        assertEquals(accentSteps.single { it.step == 400 }.value, assertNotNull(repository.resolveHex)(400))
    }

    @Test
    fun `тема без палитры получает её при первом обращении`() = runBlocking {
        val full = TenantPaletteSnapshot(golden.scenarioState(), golden.scenarioTokens(), golden.scenarioValues())
        val empty = full.copy(state = full.state.copy(template = emptyMap(), groups = emptyList(), ramps = emptyList()))
        val bare = FakeTenantPaletteRepository(empty, initialized = full)

        val palette = success(GetTenantPaletteUseCase(policy, transactions, bare).execute(owner, tenantId))

        assertEquals(tenantId, bare.initializedTenant)
        assertEquals(full.state.groups.map { it.id }, palette.groups.map { it.id })
    }

    @Test
    fun `тему общей дизайн-системы проект только читает`() = runBlocking {
        val shared = FakeTenantPaletteRepository(
            TenantPaletteSnapshot(
                golden.scenarioState(),
                golden.scenarioTokens(),
                golden.scenarioValues(),
                owned = false,
            ),
        )
        val sharedMutator = TenantPaletteMutator(policy, transactions, shared)

        assertEquals(
            false,
            success(GetTenantPaletteUseCase(policy, transactions, shared).execute(owner, tenantId)).canEdit,
        )
        val create = CreateTenantPaletteGroupUseCase(sharedMutator) { UUID.fromString(NEW_GROUP_ID) }
        assertEquals(DsFailure.NotFound, failure(create.execute(owner, tenantId, "Icons", revision)))
        val preview = PreviewTenantPaletteRampRebuildUseCase(sharedMutator)
            .execute(owner, tenantId, accentGreen, PaletteAnchor(500, "#1F8A70"), revision)
        assertEquals(DsFailure.NotFound, failure(preview))
        assertNull(shared.saved)
    }

    private fun <T> success(result: DsResult<T>): T = assertIs<DsResult.Success<T>>(result).value

    private fun failure(result: DsResult<*>): DsFailure = assertIs<DsResult.Failure>(result).error

    private fun conflict(result: DsResult<*>): DsFailure.Conflict = assertIs<DsFailure.Conflict>(failure(result))

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    )

    private companion object {
        const val NEW_GROUP_ID = "6f1c2b8e-3d4a-4e5f-8a9b-0c1d2e3f4a5b"
    }
}
