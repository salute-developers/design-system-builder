package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.ImmediateTransactions
import com.dsbuilder.ds.themes.application.palette.FakeTenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.palette.PaletteGoldenTest
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Добавление и удаление состояния цветового токена: состав членов и тем, значения каждой темы, права и ревизии. */
class ColorTokenStateUseCaseTest {
    private val golden = PaletteGoldenTest()
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()
    private val current = UUID.fromString("00000000-0000-4000-8000-000000000001")
    private val other = UUID.fromString("00000000-0000-4000-8000-000000000002")
    private val palette = FakeTenantPaletteRepository(
        TenantPaletteSnapshot(golden.scenarioState(), golden.scenarioTokens(), golden.scenarioValues()),
    )
    private val tokens = FakeColorTokenRepository(tenantIds = listOf(current, other))
    private val group = UUID.randomUUID()
    private val accent = tokens.define("text.default.accent", groupId = group, position = 3)
    private val onDark = tokens.define("text.on-dark.accent", groupId = group, position = 3)
    private val add = AddColorTokenStateUseCase(policy, transactions, tokens, palette)
    private val delete = DeleteColorTokenStateUseCase(policy, transactions, tokens)

    @Test
    fun `состояние получает члены всех подгрупп на месте семейства и значения каждой темы`() = runBlocking {
        val result = success(add.execute(context("editor"), current, onDark, command()))

        val hover = tokens.named("text.default.accent-hover")
        val onDarkHover = tokens.named("text.on-dark.accent-hover")
        assertEquals(group to 3, hover.groupId to hover.position)
        assertEquals(group to 3, onDarkHover.groupId to onDarkHover.position)
        assertEquals(complete("#111111", detached = true), tokens.values[current to hover.id])
        assertEquals(complete("#222222"), tokens.values[other to hover.id])
        assertEquals(
            setOf("text.default.accent", "text.on-dark.accent", hover.name, onDarkHover.name),
            result.value.members.keys,
        )
        assertEquals(1, result.editRevision)
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
        assertEquals(true, tokens.lockedAllThemes)
    }

    @Test
    fun `существующее состояние даёт конфликт имени`() = runBlocking {
        tokens.define("text.default.accent-hover")
        val error = failure(add.execute(context("owner"), current, accent, command()))
        assertEquals(TOKEN_NAME_CONFLICT, assertIs<DsFailure.Conflict>(error).code)
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `неизвестное состояние и неполный набор значений отклоняются до транзакции`() = runBlocking {
        assertEquals(
            INVALID_TOKEN_STATE,
            code(add.execute(context("owner"), current, accent, command(state = "focus"))),
        )
        val incomplete = command(
            values = mapOf(current to "#111111", other to "#222222"),
        ).let {
            it.copy(
                tenants = it.tenants + (other to it.tenants.getValue(other).mapValues { (_, v) -> v.drop(1) }),
            )
        }
        assertEquals(INVALID_TOKEN_FAMILY, code(add.execute(context("owner"), current, accent, incomplete)))
        assertNull(tokens.lockedAllThemes)
    }

    @Test
    fun `состав тем и членов должен совпадать с дизайн-системой и семейством`() = runBlocking {
        val owner = context("owner")
        val withoutOther = command().let { it.copy(tenants = it.tenants - other) }
        assertEquals(INVALID_TOKEN_FAMILY, code(add.execute(owner, current, accent, withoutOther)))
        val withoutSubtheme = command().let { cmd ->
            cmd.copy(tenants = cmd.tenants.mapValues { (_, members) -> members - "text.on-dark.accent-hover" })
        }
        assertEquals(INVALID_TOKEN_FAMILY, code(add.execute(owner, current, accent, withoutSubtheme)))
        assertTrue(tokens.definitions.none { it.name.endsWith("-hover") })
    }

    @Test
    fun `добавление требует права записи токенов`() = runBlocking {
        assertEquals(DsFailure.Forbidden, failure(add.execute(context("viewer"), current, accent, command())))
    }

    @Test
    fun `удаление убирает только выбранное состояние всех подгрупп`() = runBlocking {
        val hover = tokens.define("text.default.accent-hover", groupId = group, position = 3)
        val onDarkHover = tokens.define("text.on-dark.accent-hover", groupId = group, position = 3)
        val active = tokens.define("text.default.accent-active", groupId = group, position = 3)
        tokens.insertValues(listOf(current, other), mapOf(hover to complete("#111111")))

        val result = success(delete.execute(context("maintainer"), current, accent, "hover", 0))

        assertEquals(setOf(accent, onDark, active), tokens.definitions.map { it.id }.toSet())
        assertTrue(tokens.values.keys.none { it.second == hover || it.second == onDarkHover })
        assertEquals(1, result.editRevision)
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
    }

    @Test
    fun `удаление отсутствующего или неизвестного состояния`() = runBlocking {
        assertEquals(DsFailure.NotFound, failure(delete.execute(context("maintainer"), current, accent, "active", 0)))
        assertEquals(INVALID_TOKEN_STATE, code(delete.execute(context("maintainer"), current, accent, "focus", 0)))
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `удаление требует права удаления токенов`() = runBlocking {
        tokens.define("text.default.accent-hover")
        assertEquals(DsFailure.Forbidden, failure(delete.execute(context("editor"), current, accent, "hover", 0)))
        assertEquals(1, tokens.definitions.count { it.name.endsWith("-hover") })
    }

    private fun command(
        state: String = "hover",
        values: Map<UUID, String> = mapOf(current to "#111111", other to "#222222"),
    ) = AddColorTokenState(
        0,
        state,
        values.mapValues { (tenant, color) ->
            listOf("text.default.accent-$state", "text.on-dark.accent-$state").associateWith { name ->
                complete(color, detached = tenant == current && name.contains(".default."))
            }
        },
    )

    private fun complete(value: String, detached: Boolean = false) = ThemeTokenPlatform.entries.flatMap { platform ->
        ThemeTokenMode.entries.map { mode ->
            ColorTokenValue(platform, mode, null, JsonArray(listOf(JsonPrimitive(value))), detached = detached)
        }
    }

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    )

    private fun <T> success(result: DsResult<T>): T = assertIs<DsResult.Success<T>>(result).value

    private fun failure(result: DsResult<*>): DsFailure = assertIs<DsResult.Failure>(result).error

    private fun code(result: DsResult<*>): String = assertIs<DsFailure.InvalidRequest>(failure(result)).code
}
