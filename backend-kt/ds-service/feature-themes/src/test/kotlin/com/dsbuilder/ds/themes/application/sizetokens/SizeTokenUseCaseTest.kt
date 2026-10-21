package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.palette.FakeTenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.ThemePaletteType
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.palette.PaletteGroupKind
import com.dsbuilder.ds.themes.domain.palette.PaletteRampRef
import com.dsbuilder.ds.themes.domain.palette.StoredPaletteGroup
import com.dsbuilder.ds.themes.domain.palette.SystemPaletteGroup
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteState
import com.dsbuilder.ds.themes.domain.sizetokens.AdjustedUsage
import com.dsbuilder.ds.themes.domain.sizetokens.ComponentUsage
import com.dsbuilder.ds.themes.domain.sizetokens.DerivedRadius
import com.dsbuilder.ds.themes.domain.sizetokens.DimensionTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.NativePlatform
import com.dsbuilder.ds.themes.domain.sizetokens.RadiusOffset
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowLayer
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizePlatformValues
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueInput
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Use case токенов размеров на модели предметных редакций: области записи, базовые редакции, `versionId`, ссылка
 * цвета слоя на палитру, права, коды ошибок и откат транзакции при отказе.
 */
class SizeTokenUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val current = UUID.fromString("00000000-0000-4000-8000-000000000001")
    private val other = UUID.fromString("00000000-0000-4000-8000-000000000002")
    private val tokens = FakeSizeTokenRepository(tenantIds = listOf(current, other))
    private val transactions = RollbackTransactions(tokens)
    private val layers = listOf(ShadowLayer(0, 4, 14, -4, "#08080814"), ShadowLayer(0, 1, 4, -1, "#0000000A"))
    private val usage = FakeSizeTokenUsageRepository(
        tokens.designSystemId,
        usage = mapOf("round.m" to listOf(ComponentUsage("Slider", 2), ComponentUsage("EmptyState", 3))),
        offsets = mapOf(
            "round.l" to listOf(
                RadiusOffset(-2, AdjustedUsage("Button", "web", "buttonRadius")),
                RadiusOffset(-2, AdjustedUsage("IconButton", "web", "iconButtonRadius")),
            ),
        ),
    )
    private val palette = FakeTenantPaletteRepository(TenantPaletteSnapshot(paletteState(), emptyList(), emptyList()))
    private val keys = mutableListOf<String>()
    private val uniqueKeys = object : UniqueKeyLockRepository {
        override suspend fun lock(designSystemId: UUID, entityType: String, normalizedKey: String) {
            keys += "$entityType:$normalizedKey"
        }
    }
    private val get = GetSizeTokensUseCase(policy, transactions, tokens, usage, palette)
    private val update = UpdateSizeTokenValueUseCase(policy, transactions, tokens, usage, palette)
    private val create = CreateSizeTokenUseCase(policy, transactions, tokens, usage, palette, uniqueKeys)
    private val delete = DeleteSizeTokenUseCase(policy, transactions, tokens)

    init {
        radius("round.m", 12)
        radius("round.l", 16)
        radius("round.circle", 10000)
        tokens.define("spacing.4x", ThemeTokenType.SPACING, write(SizeTokenKind.SPACING, SizeTokenValue.Dimension(8)))
        SizeTokenNaming.SHADOW_VARIANTS.forEach { variant ->
            listOf("s", "m").forEach { size ->
                tokens.define("$variant.$size", ThemeTokenType.SHADOW, write(SizeTokenKind.SHADOW, shadow(2)))
            }
        }
        tokens.define("round", ThemeTokenType.SHAPE)
        tokens.define("text.default.primary", ThemeTokenType.COLOR)
    }

    @Test
    fun `чтение раздела отдаёт токены по правилам имён, компоненты и вычисляемые радиусы`() = runBlocking {
        val section = success(get.execute(context("viewer"), current))

        assertEquals(setOf("round.m", "round.l", "round.circle"), section.radii.map { it.name }.toSet())
        assertEquals(listOf("spacing.4x"), section.spacing.map { it.name })
        assertEquals(8, section.shadows.size)
        assertFalse(section.canEdit)
        val roundM = section.radii.single { it.name == "round.m" }
        assertEquals(12, roundM.valuePx)
        assertEquals(listOf(ComponentUsage("EmptyState", 3), ComponentUsage("Slider", 2)), roundM.components)
        val roundL = section.radii.single { it.name == "round.l" }
        assertEquals(
            listOf(
                DerivedRadius(
                    -2,
                    14,
                    listOf(
                        AdjustedUsage("Button", "web", "buttonRadius"),
                        AdjustedUsage("IconButton", "web", "iconButtonRadius"),
                    ),
                ),
            ),
            roundL.derived,
        )
        assertNull(section.radii.single { it.name == "round.circle" }.valuePx)
        assertTrue(success(get.execute(context("editor"), current)).canEdit)
        assertEquals(DsFailure.NotFound, failure(get.execute(context("viewer"), UUID.randomUUID())))
    }

    @Test
    fun `чтение опубликованной версии идёт на её границе и не даёт править`() = runBlocking {
        val versionId = UUID.randomUUID()
        val section = success(get.execute(context("editor", versionId), current))

        assertFalse(section.canEdit)
        assertEquals(versionId, transactions.readContext?.versionId)
        assertFalse(success(get.execute(foreign("owner"), current)).canEdit)
    }

    @Test
    fun `правка радиуса меняет все платформы только текущей темы с базовыми редакциями`() = runBlocking {
        val id = tokens.id("round.m")
        val bases = mapOf(ThemeTokenPlatform.WEB to 3L, ThemeTokenPlatform.ANDROID to 2L)
        val result = success(put(id, dimension(14), baseRevisions = bases))

        assertEquals(write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(14)).stored(), tokens.values[current to id])
        assertEquals(write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(12)).stored(), tokens.values[other to id])
        assertEquals(listOf(bases), tokens.baseRevisions)
        val view = assertIs<DimensionTokenView>(result.token)
        assertEquals(14, view.valuePx)
        assertEquals(2, view.components.size)
        assertEquals(3, result.values.size)
    }

    @Test
    fun `своё значение платформы сохраняется с признаком и сбрасывается правкой без platforms`() = runBlocking {
        val id = tokens.id("round.l")
        val own = SizeValueInput(valuePx = JsonPrimitive(20), platforms = json("""{"android":18}"""))
        val first = success(put(id, own))

        val written = first.values.associateBy { it.platform }
        assertEquals(false, written.getValue(ThemeTokenPlatform.WEB).overridden)
        assertEquals(false, written.getValue(ThemeTokenPlatform.IOS).overridden)
        assertEquals(true, written.getValue(ThemeTokenPlatform.ANDROID).overridden)
        val view = assertIs<DimensionTokenView>(first.token)
        assertEquals(mapOf(NativePlatform.ANDROID to 18), view.platforms)
        assertEquals(20, view.native[NativePlatform.IOS])
        assertEquals(listOf(18), view.derived.map { it.valuePx })

        val second = success(put(id, dimension(24)))
        assertTrue(second.values.none { it.overridden })
        assertEquals(emptyMap(), assertIs<DimensionTokenView>(second.token).platforms)
    }

    @Test
    fun `правка тени меняет только этот вариант и хранит ссылку цвета слоя на палитру`() = runBlocking {
        val id = tokens.id("down.hard.m")
        val sibling = tokens.id("down.soft.m")
        val before = tokens.values[current to sibling]
        val body = SizeValueInput(
            layers = json("""[{"offsetX":0,"offsetY":2,"blur":8,"spread":0,"color":"[general.gray.900][0.16]"}]"""),
            fallbackElevation = JsonPrimitive(4),
            platforms = json(
                """{"ios":{"layers":[{"offsetX":1,"offsetY":1,"blur":1,"spread":1,"color":"#FFFFFF"}]}}""",
            ),
        )
        val result = success(put(id, body))

        val view = assertIs<ShadowTokenView>(result.token)
        assertEquals(listOf(ShadowLayer(0, 2, 8, 0, "#10101029", "[general.gray.900][0.16]")), view.layers)
        assertEquals(4, view.fallbackElevation)
        assertEquals(listOf(ShadowLayer(1, 1, 1, 1, "#FFFFFFFF")), view.platforms[NativePlatform.IOS])
        assertNull(view.platforms[NativePlatform.ANDROID])
        val stored = tokens.values.getValue(current to id)
        assertEquals("0rem 0.125rem 0.5rem 0rem [general.gray.900][0.16]", layer(stored, ThemeTokenPlatform.WEB))
        val android = (stored.getValue(ThemeTokenPlatform.ANDROID).value as JsonArray).single() as JsonObject
        assertEquals("[general.gray.900][0.16]", android.getValue("color").jsonPrimitive.content)
        assertEquals(before, tokens.values[current to sibling])
    }

    @Test
    fun `ссылка на ступень вне палитры темы и другие отказы изменения не меняют данные`() = runBlocking {
        val roundM = tokens.id("round.m")
        val shadowId = tokens.id("up.hard.m")
        val snapshot = tokens.values.toMap()

        val missing = SizeValueInput(
            layers = json("""[{"offsetX":0,"offsetY":2,"blur":8,"spread":0,"color":"[general.red.500]"}]"""),
        )
        val step = assertIs<DsFailure.InvalidRequest>(failure(put(shadowId, missing)))
        assertEquals(INVALID_SIZE_VALUE, step.code)
        assertEquals("layers[0].color", step.details["field"])
        assertEquals("Ступени нет в палитре темы.", step.message)
        assertEquals(INVALID_SIZE_TOKEN, code(put(tokens.id("round.circle"), dimension(4))))
        assertEquals(INVALID_SIZE_TOKEN, code(put(tokens.id("round"), dimension(4))))
        assertEquals(INVALID_SIZE_TOKEN, code(put(tokens.id("text.default.primary"), dimension(4))))
        val invalid = assertIs<DsFailure.InvalidRequest>(failure(put(roundM, SizeValueInput(JsonPrimitive(12.5)))))
        assertEquals(INVALID_SIZE_VALUE, invalid.code)
        assertEquals("valuePx", invalid.details["field"])
        assertEquals("Размер должен быть целым числом.", invalid.message)
        assertEquals(INVALID_SIZE_VALUE, code(put(tokens.id("up.soft.s"), dimension(4))))
        val negative = mapOf(ThemeTokenPlatform.WEB to -1L)
        assertEquals("invalid_base_revision", code(put(roundM, dimension(4), baseRevisions = negative)))
        val historical = context("editor", UUID.randomUUID())
        assertEquals("historical_version_read_only", code(put(roundM, dimension(4), historical)))
        assertEquals(DsFailure.Forbidden, failure(put(roundM, dimension(4), context("viewer"))))
        assertEquals(DsFailure.NotFound, failure(put(UUID.randomUUID(), dimension(4))))
        assertEquals(DsFailure.NotFound, failure(put(roundM, dimension(4), foreign("editor"))))
        assertEquals(snapshot, tokens.values.toMap())
    }

    @Test
    fun `создание радиуса пишет значения во все темы под блокировкой имени`() = runBlocking {
        val created = success(add(SizeTokenKind.RADIUS, "xxxl", dimension(40), context("maintainer"))).created

        val token = assertIs<DimensionTokenView>(created.single())
        assertEquals("round.xxxl", token.name)
        assertEquals(40, token.valuePx)
        val expected = write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(40)).stored()
        assertEquals(expected, tokens.values[current to token.tokenId])
        assertEquals(expected, tokens.values[other to token.tokenId])
        assertEquals(listOf("token:round.xxxl"), keys)
    }

    @Test
    fun `создание размера тени создаёт четыре варианта и проверяет ссылки слоёв`() = runBlocking {
        val variants = SizeTokenNaming.SHADOW_VARIANTS.reversed().joinToString(",") { variant ->
            """{"variant":"$variant","layers":[{"offsetX":0,"offsetY":2,"blur":4,"spread":0,""" +
                """"color":"[general.gray.900]"}],"fallbackElevation":2}"""
        }
        val result = success(add(SizeTokenKind.SHADOW, "xl", SizeValueInput(variants = json("[$variants]"))))

        assertEquals(SizeTokenNaming.shadowSizeNames("xl"), result.created.map { it.name })
        result.created.forEach { token ->
            val shadow = assertIs<ShadowTokenView>(token)
            assertEquals(2, shadow.fallbackElevation)
            assertEquals("#101010FF", shadow.layers.single().color)
            assertEquals("[general.gray.900]", shadow.layers.single().colorRef)
            assertTrue(tokens.values.containsKey(other to token.tokenId))
        }
        assertEquals(SizeTokenNaming.shadowSizeNames("xl").map { "token:$it" }.sorted(), keys)

        // Ссылка вне палитры в третьем варианте запроса: ни одного токена, поле — по индексу запроса.
        val broken = SizeTokenNaming.SHADOW_VARIANTS.mapIndexed { index, variant ->
            val color = if (index == 2) "[general.red.500]" else "#000000"
            """{"variant":"$variant","layers":[{"offsetX":0,"offsetY":2,"blur":4,"spread":0,"color":"$color"}]}"""
        }.joinToString(",")
        val before = tokens.definitions.size
        val step = assertIs<DsFailure.InvalidRequest>(
            failure(add(SizeTokenKind.SHADOW, "xxl", SizeValueInput(variants = json("[$broken]")))),
        )
        assertEquals("variants[2].layers[0].color", step.details["field"])
        assertEquals(before, tokens.definitions.size)
    }

    @Test
    fun `отказы создания до записи`() = runBlocking {
        val definitions = tokens.definitions.size

        assertEquals("INVALID_TOKEN_NAME", code(add(SizeTokenKind.RADIUS, "X L", dimension(1))))
        assertEquals("INVALID_TOKEN_NAME", code(add(SizeTokenKind.RADIUS, "", dimension(1))))
        assertEquals("TOKEN_NAME_CONFLICT", code(add(SizeTokenKind.RADIUS, "m", dimension(1))))
        val threeVariants = SizeTokenNaming.SHADOW_VARIANTS.drop(1).joinToString(",") { variant ->
            """{"variant":"$variant","layers":[{"offsetX":0,"offsetY":2,"blur":4,"spread":0,"color":"#000000"}]}"""
        }
        val shadow = SizeValueInput(variants = json("[$threeVariants]"))
        assertEquals(INVALID_SIZE_VALUE, code(add(SizeTokenKind.SHADOW, "xl", shadow)))
        assertEquals(INVALID_SIZE_VALUE, code(add(SizeTokenKind.SPACING, "14x", dimension(140))))
        assertEquals(DsFailure.Forbidden, failure(add(SizeTokenKind.RADIUS, "x", dimension(1), context("viewer"))))
        val historical = context("owner", UUID.randomUUID())
        assertEquals("historical_version_read_only", code(add(SizeTokenKind.RADIUS, "x", dimension(1), historical)))
        assertEquals(definitions, tokens.definitions.size)
    }

    @Test
    fun `имя удалённого в черновике токена свободно для нового токена`() = runBlocking {
        val roundM = tokens.id("round.m")
        success(delete.execute(context("owner"), current, roundM))

        val created = success(add(SizeTokenKind.RADIUS, "m", dimension(12))).created.single()
        assertNotEquals(roundM, created.tokenId)
        assertEquals(created.tokenId, tokens.id("round.m"))
    }

    @Test
    fun `удаление тени удаляет размер целиком во всех темах`() = runBlocking {
        val upHard = tokens.id("up.hard.m")
        val ids = SizeTokenNaming.shadowSizeNames("m").map(tokens::id)

        assertEquals(DsFailure.Forbidden, failure(delete.execute(context("editor"), current, upHard)))
        val result = success(delete.execute(context("maintainer"), current, upHard))

        assertEquals(ids, result)
        assertTrue(tokens.definitions.filter { it.id in ids }.all { it.deleted })
        assertTrue(tokens.values.keys.none { it.second in ids })
        val shadows = success(get.execute(context("viewer"), current)).shadows.map { it.name }.toSet()
        assertEquals(SizeTokenNaming.shadowSizeNames("s").toSet(), shadows)
    }

    @Test
    fun `удаление радиуса и отказы удаления`() = runBlocking {
        val circle = tokens.id("round.circle")
        assertEquals(listOf(circle), success(delete.execute(context("owner"), current, circle)))

        val color = tokens.id("text.default.primary")
        assertEquals(INVALID_SIZE_TOKEN, code(delete.execute(context("owner"), current, color)))
        assertEquals(DsFailure.NotFound, failure(delete.execute(context("owner"), current, circle)))
        assertEquals(DsFailure.NotFound, failure(delete.execute(foreign("owner"), current, tokens.id("round.m"))))
        val historical = context("owner", UUID.randomUUID())
        assertEquals("historical_version_read_only", code(delete.execute(historical, current, tokens.id("round.m"))))
        assertTrue(tokens.definitions.any { it.name == "round.m" && !it.deleted })
    }

    private fun radius(name: String, px: Int) =
        tokens.define(name, ThemeTokenType.SHAPE, write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(px)))

    private fun shadow(fallback: Int) = SizeTokenValue.Shadow(layers, fallback)

    private fun write(kind: SizeTokenKind, value: SizeTokenValue) = SizePlatformValues.write(kind, value)

    private fun List<SizeWrittenValue>.stored() = associate { it.platform to SizeStoredValue(it.value, it.overridden) }

    private fun layer(stored: Map<ThemeTokenPlatform, SizeStoredValue>, platform: ThemeTokenPlatform): String =
        (stored.getValue(platform).value as JsonArray).single().jsonPrimitive.content

    private fun dimension(px: Int) = SizeValueInput(valuePx = JsonPrimitive(px))

    private suspend fun put(
        tokenId: UUID,
        value: SizeValueInput,
        actor: DsRequestContext = context("editor"),
        baseRevisions: Map<ThemeTokenPlatform, Long> = emptyMap(),
    ) = update.execute(actor, current, tokenId, UpdateSizeTokenValue(value, baseRevisions))

    private suspend fun add(
        kind: SizeTokenKind,
        name: String,
        value: SizeValueInput,
        actor: DsRequestContext = context("owner"),
    ) = create.execute(actor, current, CreateSizeToken(kind, name, value))

    private fun json(text: String) = Json.parseToJsonElement(text)

    private fun context(role: String, versionId: UUID? = null) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
        versionId = versionId,
    )

    private fun foreign(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-2", "project-2", role),
        "correlation-2",
    )

    private fun <T> success(result: DsResult<T>): T = assertIs<DsResult.Success<T>>(result).value

    private fun failure(result: DsResult<*>): DsFailure = assertIs<DsResult.Failure>(result).error

    private fun code(result: DsResult<*>): String = when (val error = failure(result)) {
        is DsFailure.InvalidRequest -> error.code
        is DsFailure.Conflict -> error.code
        else -> error.toString()
    }

    private companion object {
        /** Палитра темы: системные группы и одна ступень `general.gray.900`. */
        fun paletteState() = TenantPaletteState(
            editRevision = 0,
            template = mapOf(PaletteRampRef(ThemePaletteType.GENERAL, "gray") to mapOf(900 to "#101010")),
            groups = SystemPaletteGroup.entries.map { key ->
                StoredPaletteGroup("group-${key.name.lowercase()}", PaletteGroupKind.SYSTEM, key, key.name)
            },
            ramps = emptyList(),
            tokenGroups = emptyMap(),
        )
    }
}
