package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TokenValueWrite
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
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
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
        assertEquals(1, success(update.execute(context("editor"), current, id, values)).editRevision)
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
        assertEquals(1, revision.editRevision)
        assertEquals(ThemeTokenType.COLOR, revision.value)
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

    @Test
    fun `градиент в одном режиме одной темы меняет тип семейства без редакций других тем`() = runBlocking {
        val base = tokens.define("surface.default.accent")
        val hover = tokens.define("surface.default.accent-hover")
        tokens.values[current to base] = complete("#111111")
        tokens.values[other to base] = complete("#222222")
        tokens.values[current to hover] = complete("#333333")
        val otherBefore = tokens.values.filterKeys { it.first == other }

        val result = success(update.execute(context("editor"), current, hover, gradientIn(base, ThemeTokenMode.DARK)))

        assertEquals(ThemeTokenType.GRADIENT, result.value)
        assertEquals(setOf(base, hover), tokens.revisedTypes.map { it.first }.toSet())
        assertTrue(tokens.revisedTypes.all { it.second == ThemeTokenType.GRADIENT })
        assertTrue(tokens.definitions.all { it.type == ThemeTokenType.GRADIENT })
        assertEquals(listOf(listOf(base, hover).sorted()), tokens.lockedDefinitions.distinct())
        assertEquals(otherBefore, tokens.values.filterKeys { it.first == other })

        // Тип не меняется — редакций определений нет; последний градиент убран — семейство снова цветовое.
        tokens.revisedTypes.clear()
        val same = success(update.execute(context("editor"), current, hover, gradientIn(base, ThemeTokenMode.LIGHT)))
        assertEquals(ThemeTokenType.GRADIENT, same.value)
        assertTrue(tokens.revisedTypes.isEmpty())
        val solid = UpdateColorTokenValues(tokens.revisions.getValue(current), mapOf(base to complete("#444444")))
        assertEquals(ThemeTokenType.COLOR, success(update.execute(context("editor"), current, base, solid)).value)
        assertTrue(tokens.definitions.all { it.type == ThemeTokenType.COLOR })
    }

    @Test
    fun `сплошной слой платформы хранится строкой, overridden сохраняется и запрещён у web`() = runBlocking {
        val base = tokens.define("text.default.accent")
        val layer = Json.parseToJsonElement("""[{"kind":"color","background":"#1A9E32FF"}]""")
        val values = complete("#1A9E32FF").map { value ->
            if (value.platform == ThemeTokenPlatform.IOS) value.copy(value = layer, overridden = true) else value
        }

        val result = success(
            update.execute(context("editor"), current, base, UpdateColorTokenValues(0, mapOf(base to values))),
        )

        assertEquals(ThemeTokenType.COLOR, result.value)
        val ios = tokens.values.getValue(current to base).filter { it.platform == ThemeTokenPlatform.IOS }
        assertTrue(ios.all { it.overridden && it.value == JsonArray(listOf(JsonPrimitive("#1A9E32FF"))) })
        val web = values.map { if (it.platform == ThemeTokenPlatform.WEB) it.copy(overridden = true) else it }
        val revision = tokens.revisions.getValue(current)
        val error = failure(
            update.execute(context("editor"), current, base, UpdateColorTokenValues(revision, mapOf(base to web))),
        )
        assertEquals(INVALID_TOKEN_VALUE, assertIs<DsFailure.InvalidRequest>(error).code)
        assertEquals("$base:web:light", error.details["address"])
    }

    @Test
    fun `создание с градиентом в значении даёт градиентное семейство`() = runBlocking {
        val gradient = complete("#FFFFFF").map { value ->
            if (value.platform == ThemeTokenPlatform.WEB && value.mode == ThemeTokenMode.DARK) {
                value.copy(value = JsonArray(listOf(JsonPrimitive(LINEAR))))
            } else {
                value
            }
        }
        val members = mapOf("text.default.highlight" to gradient, "text.on-dark.highlight" to complete("#FFFFFF"))

        val result = success(create.execute(context("maintainer"), current, command(members = members)))

        assertEquals(ThemeTokenType.GRADIENT, result.value.family.type)
        assertTrue(tokens.definitions.all { it.type == ThemeTokenType.GRADIENT })
        assertTrue(tokens.revisedTypes.isEmpty(), "определения сразу создаются с вычисленным типом")
    }

    @Test
    fun `откат значения в журнале пересчитывает тип семейства`() {
        val base = tokens.define("text.default.accent", ThemeTokenType.GRADIENT)
        val hover = tokens.define("text.default.accent-hover", ThemeTokenType.GRADIENT)
        tokens.values[current to base] = complete("#111111")
        tokens.values[current to hover] = complete("#222222")

        ColorTokenRevertListener(tokens).beforeRevert(tokens.designSystemId, hover)()

        assertTrue(tokens.definitions.all { it.type == ThemeTokenType.COLOR })
        assertEquals(setOf(base, hover), tokens.revisedTypes.map { it.first }.toSet())
        val typography = tokens.define("screen-s.display.l", ThemeTokenType.TYPOGRAPHY)
        assertNull(ColorTokenFamilyTypeSync(tokens).sync(tokens.designSystemId, typography))
    }

    @Test
    fun `откат переименования пересчитывает тип нового и прежнего семейства`() {
        val base = tokens.define("text.default.accent", ThemeTokenType.GRADIENT)
        val hover = tokens.define("text.default.accent-hover", ThemeTokenType.GRADIENT)
        tokens.values[current to base] = complete("#111111")
        tokens.values[current to hover] = complete("#222222").map { value ->
            val linear = JsonArray(listOf(JsonPrimitive(LINEAR)))
            if (value.platform == ThemeTokenPlatform.WEB) value.copy(value = linear) else value
        }
        val after = ColorTokenRevertListener(tokens).beforeRevert(tokens.designSystemId, hover)
        // Откат вернул члену `hover` прежнее имя другого семейства; прежний сосед остался без градиента.
        tokens.rename(hover, "text.default.brand-hover")

        after()

        assertEquals(ThemeTokenType.GRADIENT, tokens.definitions.single { it.id == hover }.type)
        assertEquals(ThemeTokenType.COLOR, tokens.definitions.single { it.id == base }.type)
    }

    @Test
    fun `откат определения одного члена приводит все члены к типу по значениям`() {
        // Градиент только у `brand-hover`; откат записи определения `brand` вернул ему прежний тип `color`.
        val base = tokens.define("text.default.brand", ThemeTokenType.COLOR)
        val hover = tokens.define("text.default.brand-hover", ThemeTokenType.GRADIENT)
        tokens.values[current to base] = complete("#111111")
        tokens.values[current to hover] = gradientIn(hover, ThemeTokenMode.DARK).members.getValue(hover)

        ColorTokenRevertListener(tokens).beforeRevert(tokens.designSystemId, base)()

        assertEquals(setOf(ThemeTokenType.GRADIENT), tokens.definitions.map { it.type }.toSet())
        assertEquals(listOf(base to ThemeTokenType.GRADIENT), tokens.revisedTypes)
    }

    @Test
    fun `изменение значений принимает членов семейства с разными типами и выравнивает тип`() = runBlocking {
        val base = tokens.define("text.default.brand", ThemeTokenType.COLOR)
        val hover = tokens.define("text.default.brand-hover", ThemeTokenType.GRADIENT)
        val command = UpdateColorTokenValues(
            tokens.revisions.getValue(current),
            mapOf(base to complete("#111111"), hover to complete("#222222")),
        )

        val result = success(update.execute(context("editor"), current, base, command))

        assertEquals(ThemeTokenType.COLOR, result.value)
        assertEquals(setOf(ThemeTokenType.COLOR), tokens.definitions.map { it.type }.toSet())
    }

    @Test
    fun `откат определения сначала блокирует определения семейства в устойчивом порядке`() {
        val base = tokens.define("text.default.brand", ThemeTokenType.COLOR)
        val hover = tokens.define("text.default.brand-hover", ThemeTokenType.GRADIENT)
        val typography = tokens.define("screen-s.display.l", ThemeTokenType.TYPOGRAPHY)

        assertTrue(ColorTokenRevertListener(tokens).prepareRevert(tokens.designSystemId, hover))
        assertTrue(ColorTokenRevertListener(tokens).prepareRevert(tokens.designSystemId, typography))

        assertEquals(listOf(listOf(base, hover).sorted()), tokens.lockedDefinitions)
    }

    @Test
    fun `удаление темы с единственным градиентом возвращает семейству тип color`() {
        val base = tokens.define("text.default.brand", ThemeTokenType.GRADIENT)
        val hover = tokens.define("text.default.brand-hover", ThemeTokenType.GRADIENT)
        tokens.values[current to base] = complete("#111111")
        tokens.values[other to base] = gradientIn(base, ThemeTokenMode.DARK).members.getValue(base)
        tokens.values[current to hover] = complete("#222222")
        // Тема удалена: её значения больше не действуют на границе черновика.
        tokens.values.keys.removeAll { (tenant, _) -> tenant == other }

        ColorTokenFamilyTypeSync(tokens).syncTenantFamilies(tokens.designSystemId, other)

        assertEquals(setOf(ThemeTokenType.COLOR), tokens.definitions.map { it.type }.toSet())
        assertEquals(1, tokens.lockedDefinitions.count { it == listOf(base, hover).sorted() }, "семейство — один раз")
    }

    @Test
    fun `общий маршрут значения проверяет вид, хранит сплошной слой строкой и пересчитывает тип`() = runBlocking {
        val base = tokens.define("text.default.brand", ThemeTokenType.COLOR)
        val writes = ColorTokenValueWritePolicy(tokens, palette)
        val layer = Json.parseToJsonElement("""[{"kind":"color","background":"#123456"}]""")

        val stored = success(writes.prepare(TokenValueWrite(base, current, "ios", false, layer)))
        assertEquals(JsonArray(listOf(JsonPrimitive("#123456"))), stored)
        val notColor = JsonArray(listOf(JsonPrimitive("x")))
        val invalid = writes.prepare(TokenValueWrite(base, current, "web", false, notColor))
        assertEquals(INVALID_TOKEN_VALUE, code(invalid))
        val gradient = JsonArray(listOf(JsonPrimitive(LINEAR)))
        assertEquals(gradient, success(writes.prepare(TokenValueWrite(base, current, "web", false, gradient))))

        tokens.values[current to base] = complete("#111111").map { value ->
            if (value.platform == ThemeTokenPlatform.WEB) value.copy(value = gradient) else value
        }
        writes.afterWrite(base)
        assertEquals(ThemeTokenType.GRADIENT, tokens.definitions.single().type)
    }

    @Test
    fun `пересчёт семейств темы блокирует члены всех семейств одним вызовом в порядке идентификаторов`() {
        val brand = tokens.define("text.default.brand", ThemeTokenType.GRADIENT)
        val brandHover = tokens.define("text.default.brand-hover", ThemeTokenType.GRADIENT)
        val accent = tokens.define("surface.default.accent", ThemeTokenType.GRADIENT)
        tokens.values[current to brand] = complete("#111111")
        tokens.values[current to accent] = complete("#222222")

        ColorTokenFamilyTypeSync(tokens).syncTenantFamilies(tokens.designSystemId, other)

        assertEquals(listOf(listOf(brand, brandHover, accent).sorted()), tokens.lockedDefinitions)
        assertEquals(setOf(ThemeTokenType.COLOR), tokens.definitions.map { it.type }.toSet())
    }

    @Test
    fun `подготовка отката определения отдаёт отказ блокировки и не скрывает ошибки хранилища`() {
        val base = tokens.define("text.default.brand", ThemeTokenType.COLOR)
        tokens.lockRefused = true
        assertFalse(ColorTokenRevertListener(tokens).prepareRevert(tokens.designSystemId, base))

        val failing = object : ColorTokenRepository by tokens {
            override fun lockFamilyDefinitions(designSystemId: UUID, tokenIds: Collection<UUID>): Boolean =
                throw IllegalStateException("SQL")
        }
        assertFailsWith<IllegalStateException> {
            ColorTokenRevertListener(failing).prepareRevert(tokens.designSystemId, base)
        }
    }

    @Test
    fun `общий маршрут не ищет семейство после записи значения не цветового токена`() = runBlocking {
        val typography = tokens.define("screen-s.display.l", ThemeTokenType.TYPOGRAPHY)
        var lookups = 0
        val counting = object : ColorTokenRepository by tokens {
            override fun designSystemOf(tokenId: UUID): UUID? = tokens.designSystemOf(tokenId).also { lookups++ }

            override fun familyInDraft(designSystemId: UUID, tokenId: UUID): StoredColorTokenFamily? =
                tokens.familyInDraft(designSystemId, tokenId).also { lookups++ }
        }

        ColorTokenValueWritePolicy(counting, palette).afterWrite(typography)

        assertEquals(0, lookups)
        assertTrue(tokens.lockedDefinitions.isEmpty())
    }

    @Test
    fun `общий маршрут выбирает проверку по семейству под блокировкой определений`() = runBlocking {
        val base = tokens.define("text.default.brand", ThemeTokenType.COLOR)
        val hover = tokens.define("text.default.brand-hover", ThemeTokenType.COLOR)
        val gradient = JsonArray(listOf(JsonPrimitive(LINEAR)))
        // Переименование завершилось, пока запись ждала блокировку: токен вышел из семейства.
        val renaming = object : ColorTokenRepository by tokens {
            override fun lockFamilyDefinitions(designSystemId: UUID, tokenIds: Collection<UUID>): Boolean {
                tokens.definitions.replaceAll { if (it.id == base) it.copy(name = "brand") else it }
                return tokens.lockFamilyDefinitions(designSystemId, tokenIds)
            }
        }

        val result = ColorTokenValueWritePolicy(renaming, palette)
            .prepare(TokenValueWrite(base, current, "web", false, gradient))

        assertEquals(INVALID_TOKEN_VALUE, code(result), "вне семейства токен color проверяется по типу")
        assertEquals(listOf(listOf(base, hover).sorted()), tokens.lockedDefinitions)

        tokens.lockRefused = true
        val refused = ColorTokenValueWritePolicy(tokens, palette)
            .prepare(TokenValueWrite(hover, current, "web", false, gradient))
        assertEquals(DsFailure.NotFound, failure(refused))
    }

    private fun gradientIn(tokenId: UUID, mode: ThemeTokenMode): UpdateColorTokenValues {
        val values = complete("#111111").map { value ->
            if (value.mode == mode && value.platform == ThemeTokenPlatform.WEB) {
                value.copy(value = JsonArray(listOf(JsonPrimitive(LINEAR))))
            } else {
                value
            }
        }
        return UpdateColorTokenValues(tokens.revisions.getValue(current), mapOf(tokenId to values))
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

private const val LINEAR = "linear-gradient(90deg, #FFFFFF 0%, #000000 100%)"

private fun unsupported(): TenantRepository = java.lang.reflect.Proxy.newProxyInstance(
    TenantRepository::class.java.classLoader,
    arrayOf(TenantRepository::class.java),
) { _, method, _ -> error("${method.name} не используется в тесте") } as TenantRepository
