package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.ImmediateTransactions
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
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
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Use case токенов размеров: области записи, ревизии тем, права, коды ошибок и отсутствие частичных изменений. */
class SizeTokenUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()
    private val current = UUID.fromString("00000000-0000-4000-8000-000000000001")
    private val other = UUID.fromString("00000000-0000-4000-8000-000000000002")
    private val tokens = FakeSizeTokenRepository(tenantIds = listOf(current, other))
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
    private val get = GetSizeTokensUseCase(policy, transactions, tokens, usage)
    private val update = UpdateSizeTokenValueUseCase(policy, transactions, tokens, usage)
    private val create = CreateSizeTokenUseCase(policy, transactions, tokens, usage)
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
        assertEquals(false, section.canEdit)
        assertEquals(0, section.editRevision)
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
        assertEquals(true, success(get.execute(context("editor"), current)).canEdit)
        assertEquals(DsFailure.NotFound, failure(get.execute(context("viewer"), UUID.randomUUID())))
    }

    @Test
    fun `правка радиуса меняет все платформы только текущей темы`() = runBlocking {
        val id = tokens.id("round.m")
        val result = success(put(id, dimension(14)))

        assertEquals(1, result.editRevision)
        assertEquals(mapOf(current to 1, other to 0), tokens.revisions)
        assertEquals(false, tokens.lockedAllThemes)
        assertEquals(write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(14)).stored(), tokens.values[current to id])
        assertEquals(write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(12)).stored(), tokens.values[other to id])
        val view = assertIs<DimensionTokenView>(result.value.token)
        assertEquals(14, view.valuePx)
        assertEquals(2, view.components.size)
        assertEquals(3, result.value.values.size)
    }

    @Test
    fun `своё значение платформы сохраняется с признаком и сбрасывается правкой без platforms`() = runBlocking {
        val id = tokens.id("round.l")
        val own = SizeValueInput(valuePx = JsonPrimitive(20), platforms = Json.parseToJsonElement("""{"android":18}"""))
        val first = success(put(id, own))

        val written = first.value.values.associateBy { it.platform }
        assertEquals(false, written.getValue(ThemeTokenPlatform.WEB).overridden)
        assertEquals(false, written.getValue(ThemeTokenPlatform.IOS).overridden)
        assertEquals(true, written.getValue(ThemeTokenPlatform.ANDROID).overridden)
        val view = assertIs<DimensionTokenView>(first.value.token)
        assertEquals(mapOf(NativePlatform.ANDROID to 18), view.platforms)
        assertEquals(20, view.native[NativePlatform.IOS])
        assertEquals(listOf(18), view.derived.map { it.valuePx })

        val second = success(put(id, dimension(24), revision = 1))
        assertTrue(second.value.values.none { it.overridden })
        assertEquals(emptyMap(), assertIs<DimensionTokenView>(second.value.token).platforms)
    }

    @Test
    fun `правка тени меняет только этот вариант`() = runBlocking {
        val id = tokens.id("down.hard.m")
        val sibling = tokens.id("down.soft.m")
        val before = tokens.values[current to sibling]
        val body = SizeValueInput(
            layers = Json.parseToJsonElement("""[{"offsetX":0,"offsetY":2,"blur":8,"spread":0,"color":"#000000"}]"""),
            fallbackElevation = JsonPrimitive(4),
            platforms = Json.parseToJsonElement(
                """{"ios":{"layers":[{"offsetX":1,"offsetY":1,"blur":1,"spread":1,"color":"#FFFFFF"}]}}""",
            ),
        )
        val result = success(put(id, body))

        val view = assertIs<ShadowTokenView>(result.value.token)
        assertEquals(listOf(ShadowLayer(0, 2, 8, 0, "#000000FF")), view.layers)
        assertEquals(4, view.fallbackElevation)
        assertEquals(listOf(ShadowLayer(1, 1, 1, 1, "#FFFFFFFF")), view.platforms[NativePlatform.IOS])
        assertEquals(null, view.platforms[NativePlatform.ANDROID])
        assertEquals(before, tokens.values[current to sibling])
    }

    @Test
    fun `отказы изменения не меняют данные`() = runBlocking {
        val roundM = tokens.id("round.m")
        val snapshot = tokens.values.toMap()

        assertEquals(INVALID_SIZE_TOKEN, code(put(tokens.id("round.circle"), dimension(4))))
        assertEquals(INVALID_SIZE_TOKEN, code(put(tokens.id("round"), dimension(4))))
        assertEquals(INVALID_SIZE_TOKEN, code(put(tokens.id("text.default.primary"), dimension(4))))
        val invalid = assertIs<DsFailure.InvalidRequest>(failure(put(roundM, SizeValueInput(JsonPrimitive(12.5)))))
        assertEquals(INVALID_SIZE_VALUE, invalid.code)
        assertEquals("valuePx", invalid.details["field"])
        assertEquals("Размер должен быть целым числом.", invalid.message)
        assertEquals(INVALID_SIZE_VALUE, code(put(tokens.id("up.soft.s"), dimension(4))))
        val conflict = assertIs<DsFailure.Conflict>(failure(put(roundM, dimension(4), revision = 7)))
        assertEquals(0, conflict.editRevision)
        assertEquals(DsFailure.Forbidden, failure(put(roundM, dimension(4), context("viewer"))))
        assertEquals(DsFailure.NotFound, failure(put(UUID.randomUUID(), dimension(4))))
        assertEquals(DsFailure.NotFound, failure(put(roundM, dimension(4), foreign("editor"))))
        assertEquals(snapshot, tokens.values.toMap())
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `создание радиуса пишет значения во все темы и увеличивает ревизии`() = runBlocking {
        val result = success(add(SizeTokenKind.RADIUS, "xxxl", dimension(40), context("maintainer")))

        assertEquals(1, result.editRevision)
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
        assertEquals(true, tokens.lockedAllThemes)
        val created = assertIs<DimensionTokenView>(result.value.created.single())
        assertEquals("round.xxxl", created.name)
        assertEquals(40, created.valuePx)
        val expected = write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(40)).stored()
        assertEquals(expected, tokens.values[current to created.tokenId])
        assertEquals(expected, tokens.values[other to created.tokenId])
    }

    @Test
    fun `создание размера тени создаёт четыре варианта`() = runBlocking {
        val variants = SizeTokenNaming.SHADOW_VARIANTS.reversed().joinToString(",") { variant ->
            """{"variant":"$variant","layers":[{"offsetX":0,"offsetY":2,"blur":4,"spread":0,"color":"#000000"}],""" +
                """"fallbackElevation":2}"""
        }
        val result = success(add(SizeTokenKind.SHADOW, "xl", SizeValueInput(variants = json("[$variants]"))))

        assertEquals(SizeTokenNaming.shadowSizeNames("xl"), result.value.created.map { it.name })
        result.value.created.forEach { token ->
            assertEquals(2, assertIs<ShadowTokenView>(token).fallbackElevation)
            assertTrue(tokens.values.containsKey(other to token.tokenId))
        }
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
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
        assertEquals(definitions, tokens.definitions.size)
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `удаление тени удаляет размер целиком во всех темах`() = runBlocking {
        val upHard = tokens.id("up.hard.m")
        val ids = SizeTokenNaming.shadowSizeNames("m").map(tokens::id)

        assertEquals(DsFailure.Forbidden, failure(delete.execute(context("editor"), current, upHard, 0)))
        val result = success(delete.execute(context("maintainer"), current, upHard, 0))

        assertEquals(ids, result.value)
        assertTrue(tokens.definitions.none { it.id in ids })
        assertTrue(tokens.values.keys.none { it.second in ids })
        val shadows = tokens.definitions.filter { it.type == ThemeTokenType.SHADOW }.map { it.name }.toSet()
        assertEquals(SizeTokenNaming.shadowSizeNames("s").toSet(), shadows)
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
    }

    @Test
    fun `удаление радиуса и отказы удаления`() = runBlocking {
        val circle = tokens.id("round.circle")
        val result = success(delete.execute(context("owner"), current, circle, 0))
        assertEquals(listOf(circle), result.value)

        val color = tokens.id("text.default.primary")
        assertEquals(INVALID_SIZE_TOKEN, code(delete.execute(context("owner"), current, color, 1)))
        assertEquals(DsFailure.NotFound, failure(delete.execute(context("owner"), current, circle, 1)))
        assertIs<DsFailure.Conflict>(failure(delete.execute(context("owner"), current, tokens.id("round.m"), 0)))
        assertTrue(tokens.definitions.any { it.name == "text.default.primary" })
    }

    private fun radius(name: String, px: Int) =
        tokens.define(name, ThemeTokenType.SHAPE, write(SizeTokenKind.RADIUS, SizeTokenValue.Dimension(px)))

    private fun shadow(fallback: Int) = SizeTokenValue.Shadow(layers, fallback)

    private fun write(kind: SizeTokenKind, value: SizeTokenValue) = SizePlatformValues.write(kind, value)

    private fun List<SizeWrittenValue>.stored() = associate { it.platform to SizeStoredValue(it.value, it.overridden) }

    private fun dimension(px: Int) = SizeValueInput(valuePx = JsonPrimitive(px))

    private suspend fun put(
        tokenId: UUID,
        value: SizeValueInput,
        actor: DsRequestContext = context("editor"),
        revision: Int = 0,
    ) = update.execute(actor, current, tokenId, UpdateSizeTokenValue(revision, value))

    private suspend fun add(
        kind: SizeTokenKind,
        name: String,
        value: SizeValueInput,
        actor: DsRequestContext = context("owner"),
    ) = create.execute(actor, current, CreateSizeToken(0, kind, name, value))

    private fun json(text: String) = Json.parseToJsonElement(text)

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
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
}
