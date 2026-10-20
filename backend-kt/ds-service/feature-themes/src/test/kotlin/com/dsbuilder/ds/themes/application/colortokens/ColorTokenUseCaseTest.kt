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
import com.dsbuilder.ds.themes.application.SaveTenantTokenValues
import com.dsbuilder.ds.themes.application.SaveTenantTokenValuesUseCase
import com.dsbuilder.ds.themes.application.TenantRepository
import com.dsbuilder.ds.themes.application.TenantTokenValuesSaveOutcome
import com.dsbuilder.ds.themes.application.palette.FakeTenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.application.tokengroups.FakeTokenGroupRepository
import com.dsbuilder.ds.themes.domain.TenantTokenValueInput
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.palette.PaletteGoldenTest
import com.dsbuilder.ds.themes.domain.palette.PaletteTokenRef
import com.dsbuilder.ds.themes.domain.palette.SystemPaletteGroup
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Use case цветового токена: права, ревизии тем, коды ошибок и отсутствие частичных изменений. */
class ColorTokenUseCaseTest {
    private val golden = PaletteGoldenTest()
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()
    private val current = UUID.fromString("00000000-0000-4000-8000-000000000001")
    private val other = UUID.fromString("00000000-0000-4000-8000-000000000002")
    private val palette = FakeTenantPaletteRepository(
        TenantPaletteSnapshot(golden.scenarioState(), golden.scenarioTokens(), golden.scenarioValues()),
    )
    private val tokens = FakeColorTokenRepository(tenantIds = listOf(current, other)) { inserted ->
        palette.snapshot = palette.snapshot?.let { snapshot ->
            val added = inserted.map { (name, id) -> PaletteTokenRef(id.toString(), name, null) }
            snapshot.copy(tokens = snapshot.tokens + added)
        }
    }
    private val reference = golden.scenarioState().template.entries.first().let { (ramp, steps) ->
        "[${ramp.key}.${steps.keys.first()}]"
    }
    private val family = ColorTokenFamily(ThemeTokenType.COLOR, "text", "highlight")
    private val groups = FakeTokenGroupRepository(tokens.designSystemId)
    private val create = CreateColorTokenUseCase(policy, transactions, tokens, palette, groups)
    private val update = UpdateColorTokenValuesUseCase(policy, transactions, tokens, palette)
    private val delete = DeleteColorTokenUseCase(policy, transactions, tokens)

    @Test
    fun `создание пишет определения и значения во все темы и увеличивает ревизии`() = runBlocking {
        val result = success(create.execute(context("maintainer"), current, command()))

        val names = tokens.definitions.map { it.name }.toSet()
        assertEquals(setOf("text.default.highlight", "text.on-dark.highlight"), names)
        assertEquals(result.value.members.values.toSet(), tokens.definitions.map { it.id }.toSet())
        result.value.members.values.forEach { id ->
            assertEquals(complete("#FFFFFF"), tokens.values[current to id])
            assertEquals(complete("#FFFFFF"), tokens.values[other to id])
        }
        assertEquals(1, result.editRevision)
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
        assertEquals(true, tokens.lockedAllThemes)
        assertNull(palette.saved)
    }

    @Test
    fun `группа палитры записывается явной привязкой всех членов с одной ревизией`() = runBlocking {
        val accent = golden.scenarioState().systemGroupId(SystemPaletteGroup.ACCENT)
        val result = success(create.execute(context("editor"), current, command(paletteGroupId = accent)))

        val saved = requireNotNull(palette.saved)
        result.value.members.values.forEach { assertEquals(accent, saved.tokenGroups[it.toString()]) }
        assertEquals(1, saved.editRevision)
        assertEquals(1, result.editRevision)
        assertEquals(0, tokens.revisions.getValue(current), "ревизию текущей темы записывает палитра")
        assertEquals(1, tokens.revisions.getValue(other))
    }

    @Test
    fun `неизвестная группа палитры отклоняет создание`() = runBlocking {
        val result = create.execute(context("owner"), current, command(paletteGroupId = "missing"))
        assertEquals(DsFailure.NotFound, failure(result))
        assertNull(palette.saved)
    }

    @Test
    fun `структура запроса проверяется до транзакции`() = runBlocking {
        val owner = context("owner")
        val withoutDefault = mapOf("text.on-dark.highlight" to complete("#FFF"))
        assertEquals(INVALID_TOKEN_FAMILY, code(create.execute(owner, current, command(members = withoutDefault))))
        val incomplete = mapOf("text.default.highlight" to complete("#FFF").drop(1))
        assertEquals(INVALID_TOKEN_FAMILY, code(create.execute(owner, current, command(members = incomplete))))
        val foreign = mapOf("text.default.highlight" to complete("#FFF"), "text.default.other" to complete("#FFF"))
        assertEquals(INVALID_TOKEN_FAMILY, code(create.execute(owner, current, command(members = foreign))))
        val badName = command(family = ColorTokenFamily(ThemeTokenType.COLOR, "text", "High light"))
        assertEquals(INVALID_TOKEN_NAME, code(create.execute(owner, current, badName)))
        val gradient = ColorTokenFamily(ThemeTokenType.GRADIENT, "text", "highlight")
        val gradientWithGroup = command(
            family = gradient,
            members = mapOf("text.default.highlight" to complete("linear-gradient(#fff, #000)")),
            paletteGroupId = "g",
        )
        assertEquals(INVALID_TOKEN_FAMILY, code(create.execute(owner, current, gradientWithGroup)))
        val stateName = command(family = ColorTokenFamily(ThemeTokenType.COLOR, "text", "accent-hover"))
        assertEquals(INVALID_TOKEN_NAME, code(create.execute(owner, current, stateName)))
        assertNull(tokens.lockedAllThemes)
    }

    @Test
    fun `недопустимое значение и занятое имя ничего не создают`() = runBlocking {
        val invalid = mapOf("text.default.highlight" to complete("[general.unknown.500]"))
        val error = failure(create.execute(context("owner"), current, command(members = invalid)))
        assertEquals(INVALID_TOKEN_VALUE, assertIs<DsFailure.InvalidRequest>(error).code)
        assertEquals("text.default.highlight:web:light", error.details["address"])
        assertTrue(tokens.definitions.isEmpty())

        tokens.define("text.on-dark.highlight")
        val conflict = failure(create.execute(context("owner"), current, command()))
        assertEquals(TOKEN_NAME_CONFLICT, assertIs<DsFailure.Conflict>(conflict).code)
        assertEquals(1, tokens.definitions.size)
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `права операций по ролям`() = runBlocking {
        assertEquals(DsFailure.Forbidden, failure(create.execute(context("viewer"), current, command())))
        val id = tokens.define("text.default.accent")
        val values = UpdateColorTokenValues(0, mapOf(id to complete("#000000")))
        assertEquals(DsFailure.Forbidden, failure(update.execute(context("viewer"), current, id, values)))
        assertEquals(DsFailure.Forbidden, failure(delete.execute(context("editor"), current, id, 0)))
        assertEquals(1, success(update.execute(context("editor"), current, id, values)))
    }

    @Test
    fun `отрицательная предметная редакция отклоняется до блокировки и записи`() = runBlocking {
        val id = tokens.define("text.default.accent")
        val value = complete("#000000").first().copy(baseRevision = -1)
        val result = update.execute(
            context("editor"),
            current,
            id,
            UpdateColorTokenValues(0, mapOf(id to listOf(value))),
        )
        assertEquals("invalid_base_revision", assertIs<DsFailure.InvalidRequest>(failure(result)).code)
        assertNull(tokens.lockedAllThemes)
        assertTrue(tokens.values.isEmpty())
    }

    @Test
    fun `изменение заменяет значения только членов семейства в текущей теме`() = runBlocking {
        val base = tokens.define("text.default.accent")
        val hover = tokens.define("text.default.accent-hover")
        val foreign = tokens.define("text.default.primary")
        tokens.values[other to base] = complete("#111111")

        val revision = success(
            update.execute(
                context("editor"),
                current,
                hover,
                UpdateColorTokenValues(0, mapOf(base to complete(reference), hover to complete("#000000"))),
            ),
        )
        assertEquals(1, revision)
        assertEquals(complete(reference), tokens.values[current to base])
        assertEquals(complete("#111111"), tokens.values[other to base])
        assertEquals(mapOf(current to 1, other to 0), tokens.revisions)
        assertEquals(false, tokens.lockedAllThemes)

        val outside = UpdateColorTokenValues(1, mapOf(foreign to complete("#000000")))
        assertEquals(INVALID_TOKEN_FAMILY, code(update.execute(context("editor"), current, base, outside)))
        val editor = context("editor")
        val stale = failure(update.execute(editor, current, base, UpdateColorTokenValues(0, mapOf(base to black()))))
        assertEquals(DsFailure.Conflict(TENANT_EDIT_CONFLICT, editRevision = 1), stale)
        val missing = update.execute(
            editor,
            current,
            UUID.randomUUID(),
            UpdateColorTokenValues(1, mapOf(base to black())),
        )
        assertEquals(DsFailure.NotFound, failure(missing))
        val wrongValue = UpdateColorTokenValues(1, mapOf(base to complete("blue")))
        val valueError = assertIs<DsFailure.InvalidRequest>(failure(update.execute(editor, current, base, wrongValue)))
        assertEquals("$base:web:light", valueError.details["address"])
    }

    @Test
    fun `токен вне семейства даёт INVALID_TOKEN_FAMILY, отсутствующий — 404`() = runBlocking {
        val typography = tokens.define("screen-s.display.l", ThemeTokenType.TYPOGRAPHY)
        val outside = UpdateColorTokenValues(0, mapOf(typography to black()))
        assertEquals(INVALID_TOKEN_FAMILY, code(update.execute(context("editor"), current, typography, outside)))
        assertEquals(INVALID_TOKEN_FAMILY, code(delete.execute(context("maintainer"), current, typography, 0)))
        val missing = UUID.randomUUID()
        val values = UpdateColorTokenValues(0, mapOf(missing to black()))
        assertEquals(DsFailure.NotFound, failure(update.execute(context("editor"), current, missing, values)))
        assertEquals(DsFailure.NotFound, failure(delete.execute(context("maintainer"), current, missing, 0)))
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `устаревшая ревизия и чужой проект отклоняют все операции без изменений`() = runBlocking {
        val id = tokens.define("text.default.accent")
        val maintainer = context("maintainer")
        val staleCreate = failure(create.execute(maintainer, current, command().copy(editRevision = 5)))
        assertEquals(DsFailure.Conflict(TENANT_EDIT_CONFLICT, editRevision = 0), staleCreate)
        val staleDelete = failure(delete.execute(maintainer, current, id, 5))
        assertEquals(DsFailure.Conflict(TENANT_EDIT_CONFLICT, editRevision = 0), staleDelete)
        val foreign = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user-1", "project-2", "owner"),
            "correlation-1",
        )
        assertEquals(DsFailure.NotFound, failure(create.execute(foreign, current, command())))
        val values = UpdateColorTokenValues(0, mapOf(id to black()))
        assertEquals(DsFailure.NotFound, failure(update.execute(foreign, current, id, values)))
        assertEquals(DsFailure.NotFound, failure(delete.execute(foreign, current, id, 0)))
        assertEquals(1, tokens.definitions.size)
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `пустой набор и повтор платформы при изменении отклоняются до транзакции`() = runBlocking {
        val base = tokens.define("text.default.accent")
        val duplicate = UpdateColorTokenValues(0, mapOf(base to listOf(black().first(), black().first())))
        assertEquals(INVALID_TOKEN_FAMILY, code(update.execute(context("editor"), current, base, duplicate)))
        val empty = UpdateColorTokenValues(0, mapOf(base to emptyList()))
        assertEquals(INVALID_TOKEN_FAMILY, code(update.execute(context("editor"), current, base, empty)))
        assertEquals(null, tokens.lockedAllThemes)
    }

    @Test
    fun `ключ проекта нуждается во всех правах операции`() = runBlocking {
        val tenantsOnly = key("tenants:write")
        val tokensOnly = key("tokens:write", "tokens:delete")
        assertEquals(DsFailure.Forbidden, failure(create.execute(tenantsOnly, current, command())))
        assertEquals(DsFailure.Forbidden, failure(create.execute(tokensOnly, current, command())))
        val id = tokens.define("text.default.accent")
        assertEquals(DsFailure.Forbidden, failure(delete.execute(key("tenants:write", "tokens:write"), current, id, 0)))
        assertEquals(DsFailure.Forbidden, failure(delete.execute(tokensOnly, current, id, 0)))
        val full = key("tenants:write", "tokens:write", "tokens:delete")
        assertEquals(1, success(create.execute(full, current, command())).editRevision)
        assertEquals(2, success(delete.execute(full, current, id, 1)))
    }

    @Test
    fun `удаление убирает семейство целиком и увеличивает ревизии всех тем`() = runBlocking {
        val base = tokens.define("text.default.accent")
        tokens.define("text.inverse.accent-active")
        val kept = tokens.define("text.default.primary")
        tokens.values[other to base] = complete("#111111")

        assertEquals(1, success(delete.execute(context("maintainer"), current, base, 0)))
        assertEquals(listOf(kept), tokens.definitions.map { it.id })
        assertTrue(tokens.values.isEmpty())
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
        assertEquals(DsFailure.NotFound, failure(delete.execute(context("maintainer"), current, base, 1)))
    }

    @Test
    fun `создание в подгруппе ставит семейство на позицию и сдвигает соседей`() = runBlocking {
        val text = groups.add("Text & Icons", code = "text")
        val accent = groups.add("Accent", text.id)
        val first = tokens.define("text.default.accent", groupId = accent.id, position = 0)
        val second = tokens.define("text.default.accent-minor", groupId = accent.id, position = 1)

        val result = success(create.execute(context("editor"), current, command(groupId = accent.id, position = 1)))

        val created = result.value.members.values
        assertTrue(
            created.all { id ->
                tokens.definitions.single { it.id == id }.let { it.groupId == accent.id && it.position == 1 }
            },
        )
        assertEquals(0, tokens.definitions.single { it.id == first }.position)
        assertEquals(2, tokens.definitions.single { it.id == second }.position)
    }

    @Test
    fun `создание в группе с другим кодом и в чужой группе отклоняется`() = runBlocking {
        val surface = groups.add("Surfaces", code = "surface")

        val wrongCode = create.execute(context("editor"), current, command(groupId = surface.id))
        assertEquals("INVALID_TOKEN_GROUP", code(wrongCode))
        val foreignGroup = create.execute(context("editor"), current, command(groupId = UUID.randomUUID()))
        assertEquals(DsFailure.NotFound, failure(foreignGroup))
        assertTrue(tokens.definitions.isEmpty())
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `удаление токена пересчитывает позиции его подгруппы`() = runBlocking {
        val text = groups.add("Text", code = "text")
        val removed = tokens.define("text.default.accent", groupId = text.id, position = 0)
        tokens.define("text.on-dark.accent", groupId = text.id, position = 0)
        val kept = tokens.define("text.default.primary", groupId = text.id, position = 1)

        success(delete.execute(context("maintainer"), current, removed, 0))

        assertEquals(0, tokens.definitions.single { it.id == kept }.position)
    }

    @Test
    fun `пакетное сохранение темы проверяет цветовые значения`() = runBlocking {
        val color = tokens.define("text.default.accent")
        val typography = tokens.define("screen-s.display.l", ThemeTokenType.TYPOGRAPHY)
        val save = SaveTenantTokenValuesUseCase(policy, transactions, SavingTenantRepository(), tokens, palette)
        fun input(id: UUID, value: String) = TenantTokenValueInput(
            id,
            ThemeTokenPlatform.WEB,
            ThemeTokenMode.DARK,
            null,
            JsonArray(listOf(JsonPrimitive(value))),
            baseRevision = 0,
        )

        val validValues = listOf(input(color, reference), input(typography, "x"))
        assertIs<DsResult.Success<*>>(save.execute(context("editor"), current, SaveTenantTokenValues(0, validValues)))
        val invalidValues = SaveTenantTokenValues(0, listOf(input(color, "x")))
        val invalid = failure(save.execute(context("editor"), current, invalidValues))
        assertEquals(INVALID_TOKEN_VALUE, assertIs<DsFailure.InvalidRequest>(invalid).code)
        assertEquals("$color:web:dark", invalid.details["address"])
    }

    private fun command(
        family: ColorTokenFamily = this.family,
        members: Map<String, List<ColorTokenValue>> = mapOf(
            "text.default.highlight" to complete("#FFFFFF"),
            "text.on-dark.highlight" to complete("#FFFFFF"),
        ),
        paletteGroupId: String? = null,
        groupId: UUID? = null,
        position: Int? = null,
    ) = CreateColorToken(0, family, "textHighlight", null, paletteGroupId, members, groupId, position)

    private fun complete(value: String) = ThemeTokenPlatform.entries.flatMap { platform ->
        ThemeTokenMode.entries.map { mode ->
            ColorTokenValue(platform, mode, null, JsonArray(listOf(JsonPrimitive(value))))
        }
    }

    private fun black() = complete("#000")

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    )

    private fun key(vararg scopes: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.PROJECT_KEY, "key-1", "project-1", projectScopes = scopes.toSet()),
        "correlation-1",
    )

    private fun <T> success(result: DsResult<T>): T = assertIs<DsResult.Success<T>>(result).value

    private fun failure(result: DsResult<*>): DsFailure = assertIs<DsResult.Failure>(result).error

    private fun code(result: DsResult<*>): String = assertIs<DsFailure.InvalidRequest>(failure(result)).code

    /** Хранилище темы, которое всегда принимает пакет значений. */
    private class SavingTenantRepository : TenantRepository by unsupported() {
        override suspend fun saveTokenValues(
            projectId: com.dsbuilder.ds.core.domain.ProjectId,
            id: UUID,
            command: SaveTenantTokenValues,
        ) = TenantTokenValuesSaveOutcome.Saved(command.expectedEditRevision + 1, emptyList())
    }
}

private fun unsupported(): TenantRepository = java.lang.reflect.Proxy.newProxyInstance(
    TenantRepository::class.java.classLoader,
    arrayOf(TenantRepository::class.java),
) { _, method, _ -> error("${method.name} не используется в тесте") } as TenantRepository
