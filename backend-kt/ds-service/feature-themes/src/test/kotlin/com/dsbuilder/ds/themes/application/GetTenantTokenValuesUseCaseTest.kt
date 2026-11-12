package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadContext
import com.dsbuilder.ds.core.application.ModelReadPage
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.palette.FakeTenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.PaletteGoldenTest
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenRef
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import java.lang.reflect.Proxy
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Проверяет согласованное чтение и освобождение транзакции до чистого раскрытия значений. */
class GetTenantTokenValuesUseCaseTest {
    @Test
    fun `snapshot is read inside transaction and published outside with metadata preserved`() = runBlocking {
        val transactions = RecordingReadTransaction()
        val tenant = UUID.randomUUID()
        val golden = PaletteGoldenTest()
        val tokens = golden.scenarioTokens().let { listOf(it.first().copy(id = UUID.randomUUID().toString())) + it.drop(1) }
        var published = false
        val outsideTokens = object : AbstractList<PaletteTokenRef>() {
            override val size: Int get() = tokens.size
            override fun get(index: Int): PaletteTokenRef {
                assertFalse(transactions.inside, "Раскрытие не должно удерживать транзакцию")
                published = true
                return tokens[index]
            }
        }
        val snapshot = TenantPaletteSnapshot(golden.scenarioState(), outsideTokens, golden.scenarioValues())
        val (ramp, steps) = snapshot.state.template.entries.first()
        val stored = TenantTokenValue(
            UUID.randomUUID(), UUID.fromString(tokens.first().id), tenant, null, "web", "light",
            Json.parseToJsonElement("[\"[${ramp.key}.${steps.keys.first()}]\"]"),
            3, Instant.EPOCH, Instant.EPOCH, tokenType = ThemeTokenType.COLOR,
        )
        val repository = Proxy.newProxyInstance(
            TenantRepository::class.java.classLoader, arrayOf(TenantRepository::class.java),
        ) { _, method, _ ->
            assertTrue(transactions.inside)
            check(method.name.startsWith("tokenValues-"))
            listOf(stored)
        } as TenantRepository
        val palette = object : TenantPaletteRepository by FakeTenantPaletteRepository(null) {
            override suspend fun valueSnapshot(
                projectId: ProjectId,
                tenantId: UUID,
                values: List<TenantTokenValue>,
            ): TenantPaletteSnapshot {
                assertTrue(transactions.inside)
                assertEquals(listOf(stored), values)
                return snapshot
            }
        }
        val context = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user", "project", "owner"), "read",
        )
        val result = GetTenantTokenValuesUseCase(
            DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())),
            transactions, repository, palette,
        ).execute(context, tenant)
        val success = assertIs<DsResult.Success<List<TenantTokenValue>>>(result)
        assertTrue(published)
        assertEquals(TokenValuePublisher(tenant, snapshot).publish(listOf(stored)), success.value)
        assertEquals(transactions.readContext, success.readContext)
        assertEquals(transactions.readPage, success.readPage)
        assertEquals("metadata", success.mutationMetadata)
    }

    @Test
    fun `literal values do not load a palette and still normalize platform forms`() = runBlocking {
        val transactions = RecordingReadTransaction()
        val tenant = UUID.randomUUID()
        val values = listOf(
            TenantTokenValue(
                UUID.randomUUID(), UUID.randomUUID(), tenant, null, "ios", "light",
                Json.parseToJsonElement("[\"#123456\"]"), 0, Instant.EPOCH, Instant.EPOCH,
                tokenType = ThemeTokenType.GRADIENT,
            ),
            TenantTokenValue(
                UUID.randomUUID(), UUID.randomUUID(), tenant, null, "web", "light",
                Json.parseToJsonElement("[\"0 1px 2px 0 #123456\"]"), 0, Instant.EPOCH, Instant.EPOCH,
                tokenType = ThemeTokenType.SHADOW,
            ),
        )
        val repository = Proxy.newProxyInstance(
            TenantRepository::class.java.classLoader, arrayOf(TenantRepository::class.java),
        ) { _, method, _ ->
            assertTrue(transactions.inside)
            check(method.name.startsWith("tokenValues-"))
            values
        } as TenantRepository
        val palette = FakeTenantPaletteRepository(null)
        val context = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user", "project", "owner"), "read",
        )
        val result = GetTenantTokenValuesUseCase(
            DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())),
            transactions, repository, palette,
        ).execute(context, tenant)
        assertEquals(TokenValuePublisher(tenant, null).publish(values), assertIs<DsResult.Success<*>>(result).value)
        assertEquals(0, palette.snapshotReads)
    }

    private class RecordingReadTransaction : TransactionRunner {
        var inside = false
        val readContext = ModelReadContext(UUID.randomUUID(), version = "1.0.0", versionId = UUID.randomUUID())
        val readPage = ModelReadPage(20, "next")

        override suspend fun <T> required(block: suspend () -> DsResult<T>): DsResult<T> = error("write")
        override suspend fun <T> rollback(context: DsRequestContext, block: suspend () -> DsResult<T>): DsResult<T> =
            error("rollback")

        override suspend fun <T> readOnly(block: suspend () -> DsResult<T>): DsResult<T> {
            inside = true
            val result = try { block() } finally { inside = false }
            return when (result) {
                is DsResult.Failure -> result
                is DsResult.Success -> result.copy(
                    mutationMetadata = "metadata", readContext = readContext, readPage = readPage,
                )
            }
        }
    }
}
