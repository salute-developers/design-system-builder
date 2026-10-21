package com.dsbuilder.ds.themes.application.typography

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
import com.dsbuilder.ds.themes.domain.typography.ComponentPropertyReference
import com.dsbuilder.ds.themes.domain.typography.TypographyComponentUsage
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyPlatformValues
import com.dsbuilder.ds.themes.domain.typography.TypographyScreen
import com.dsbuilder.ds.themes.domain.typography.TypographyValueRules
import com.dsbuilder.ds.themes.domain.typography.TypographyVariant
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/** Use case стилей типографии: чтение, области записи, другие темы, проверки и права. */
class TypographyStyleUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()
    private val tenantA = UUID.randomUUID()
    private val tenantB = UUID.randomUUID()
    private val ids = SCREENS.flatMap { screen -> VARIANTS.map { variant -> "$screen.body.m.$variant" } }
        .associateWith { UUID.randomUUID() }
    private val outside = UUID.randomUUID()
    private val repository = FakeTypographyStyleRepository(
        designSystemId = UUID.randomUUID(),
        tenants = setOf(tenantA, tenantB),
        definitions = ids.entries.associate { (name, id) -> id to (name to ThemeTokenType.TYPOGRAPHY) } +
            (outside to ("text.default.primary" to ThemeTokenType.COLOR)),
        values = mutableMapOf(tenantA to initialValues(), tenantB to initialValues()),
        families = listOf(TypographyFamily("display", "SB Sans Display"), TypographyFamily("body", "SB Sans Text")),
    )
    private val get = GetTypographyStylesUseCase(policy, transactions, repository, repository)
    private val update = UpdateTypographyStyleUseCase(policy, transactions, repository, repository)

    @Test
    fun `чтение отдаёт стили по экранам в px, семейства и компоненты`() = runBlocking {
        repository.references = listOf(
            ComponentPropertyReference("Button", "body.m.bold"),
            ComponentPropertyReference("Button", "body.m.normal"),
            ComponentPropertyReference("Select", "body.m.normal"),
        )
        val styles = success(get.execute(context("viewer"), tenantA))
        assertEquals(false, styles.canEdit)
        assertEquals(2, styles.themeCount)
        assertEquals(listOf("body", "display"), styles.families.map { it.name }.sorted())
        assertEquals(TypographyScreen.entries, styles.screens.map { it.screen })
        val body = styles.screens.first().styles.single()
        assertEquals(16.0, body.sizePx)
        assertEquals(20.0, body.lineHeightPx)
        assertEquals(-0.02, body.letterSpacingEm)
        assertEquals("body", body.fontFamily)
        assertEquals(listOf(400, 500, 600), TypographyVariant.entries.map { body.variants.getValue(it).weight })
        assertEquals(
            listOf(TypographyComponentUsage("Button", 2), TypographyComponentUsage("Select", 1)),
            body.components,
        )
        assertEquals(true, success(get.execute(context("editor"), tenantA)).canEdit)
        assertEquals(DsFailure.NotFound, failure(get.execute(context("viewer", "project-2"), tenantA)))
        val normal = body.variants.getValue(TypographyVariant.NORMAL)
        assertEquals(ThemeTokenPlatform.entries, normal.valueRevisions.map { it.platform })
        assertEquals(
            repository.valueId(tenantA, normal.tokenId, ThemeTokenPlatform.WEB),
            normal.valueRevisions.first().valueId,
        )
        assertEquals(listOf(0L, 0L, 0L), normal.valueRevisions.map { it.revision })
    }

    @Test
    fun `опубликованная версия читается только для чтения`() = runBlocking {
        val historical = context("editor").copy(versionId = UUID.randomUUID())
        assertEquals(false, success(get.execute(historical, tenantA)).canEdit)
    }

    @Test
    fun `размеры пишутся в три токена выбранного экрана`() = runBlocking {
        val token = ids.getValue("screen-l.body.m.normal")
        val base = repository.valueId(tenantA, token, ThemeTokenPlatform.WEB)
        val command = UpdateTypographyStyle(
            size = 18.0,
            baseRevisions = listOf(TypographyBaseRevision(token, ThemeTokenPlatform.WEB, 7)),
        )
        val result = success(update.execute(context("editor"), tenantA, token, command))
        assertEquals(18.0, result.style.sizePx)
        assertEquals(1, repository.locks)
        assertEquals(9, repository.written.size)
        assertEquals(7L, repository.written.single { it.valueId == base }.baseRevision)
        assertEquals(listOf(null), repository.written.filter { it.valueId != base }.map { it.baseRevision }.distinct())
        assertEquals(
            listOf(1L, 1L, 1L),
            result.style.variants.getValue(TypographyVariant.NORMAL).valueRevisions.map { it.revision },
        )
        assertEquals(VARIANTS.map { "screen-l.body.m.$it" }.toSet(), result.tokens.map { it.name }.toSet())
        VARIANTS.forEach { variant ->
            assertEquals("1.125rem", field(tenantA, "screen-l.body.m.$variant", ThemeTokenPlatform.WEB, "fontSize"))
            assertEquals("18", field(tenantA, "screen-l.body.m.$variant", ThemeTokenPlatform.IOS, "size"))
            assertEquals("1rem", field(tenantA, "screen-m.body.m.$variant", ThemeTokenPlatform.WEB, "fontSize"))
            assertEquals("1rem", field(tenantB, "screen-l.body.m.$variant", ThemeTokenPlatform.WEB, "fontSize"))
        }
        val tenantBValues = ids.values
            .flatMap { id -> ThemeTokenPlatform.entries.map { repository.valueId(tenantB, id, it) } }
            .toSet()
        assertEquals(emptySet(), repository.written.map { it.valueId }.toSet() intersect tenantBValues)
    }

    @Test
    fun `значение без изменений не получает редакцию`() = runBlocking {
        val token = ids.getValue("screen-l.body.m.normal")
        val same = UpdateTypographyStyle(size = 16.0, lineHeight = 20.0)
        val result = success(update.execute(context("editor"), tenantA, token, same))
        assertEquals(emptyList(), result.tokens)
        assertEquals(0, repository.written.size)
    }

    @Test
    fun `вес начертания и семейство пишутся на всех экранах`() = runBlocking {
        val token = ids.getValue("screen-s.body.m.medium")
        val command = UpdateTypographyStyle(
            weights = mapOf(TypographyVariant.BOLD to 700),
            fontFamily = "display",
        )
        val result = success(update.execute(context("editor"), tenantA, token, command))
        assertEquals(TypographyScreen.S, result.style.screen)
        assertEquals(700, result.style.variants.getValue(TypographyVariant.BOLD).weight)
        assertEquals("display", result.style.fontFamily)
        assertEquals(ids.size, result.tokens.size)
        SCREENS.forEach { screen ->
            assertEquals("700", field(tenantA, "$screen.body.m.bold", ThemeTokenPlatform.WEB, "fontWeight"))
            assertEquals("bold", field(tenantA, "$screen.body.m.bold", ThemeTokenPlatform.IOS, "weight"))
            assertEquals("500", field(tenantA, "$screen.body.m.medium", ThemeTokenPlatform.WEB, "fontWeight"))
            VARIANTS.forEach { variant ->
                assertEquals(
                    "fontFamily.display",
                    field(tenantA, "$screen.body.m.$variant", ThemeTokenPlatform.ANDROID, "fontFamilyRef"),
                )
            }
            assertEquals("600", field(tenantB, "$screen.body.m.bold", ThemeTokenPlatform.WEB, "fontWeight"))
        }
    }

    @Test
    fun `отказы не меняют данные`() = runBlocking {
        val token = ids.getValue("screen-l.body.m.normal")
        val editor = context("editor")
        val resize = UpdateTypographyStyle(size = 18.0)
        assertEquals(DsFailure.Forbidden, failure(update.execute(context("viewer"), tenantA, token, resize)))

        val negative = invalid(update.execute(editor, tenantA, token, UpdateTypographyStyle(size = -5.0)))
        assertEquals("INVALID_TYPOGRAPHY_VALUE", negative.code)
        assertEquals("size", negative.details["field"])
        assertEquals(TypographyValueRules.SIZE_MESSAGE, negative.message)
        val weight = UpdateTypographyStyle(weights = mapOf(TypographyVariant.BOLD to 450))
        assertEquals("weights.bold", invalid(update.execute(editor, tenantA, token, weight)).details["field"])
        val family = UpdateTypographyStyle(fontFamily = "missing")
        assertEquals("fontFamily", invalid(update.execute(editor, tenantA, token, family)).details["field"])

        val color = invalid(update.execute(editor, tenantA, outside, resize))
        assertEquals("INVALID_TYPOGRAPHY_STYLE", color.code)
        assertEquals(DsFailure.NotFound, failure(update.execute(editor, tenantA, UUID.randomUUID(), resize)))

        val negativeBase = resize.copy(
            baseRevisions = listOf(TypographyBaseRevision(token, ThemeTokenPlatform.WEB, -1)),
        )
        assertEquals("invalid_base_revision", invalid(update.execute(editor, tenantA, token, negativeBase)).code)
        val foreign = update.execute(context("editor", "project-2"), tenantA, token, resize)
        assertEquals(DsFailure.NotFound, failure(foreign))

        assertEquals(0, repository.written.size)
        assertEquals(emptyMap(), repository.revisions)
    }

    private fun field(tenant: UUID, name: String, platform: ThemeTokenPlatform, key: String): String? =
        repository.values.getValue(tenant).getValue(ids.getValue(name))[platform]
            .let(TypographyPlatformValues::objectOf)[key]
            ?.toString()
            ?.trim('"')

    private fun initialValues(): MutableMap<UUID, Map<ThemeTokenPlatform, JsonElement>> = ids.entries.associate {
        val (name, id) = it
        val weight = WEIGHTS.getValue(name.substringAfterLast('.'))
        val iosWeight = TypographyPlatformValues.IOS_WEIGHTS[weight]
        id to mapOf(
            ThemeTokenPlatform.WEB to json(
                """[{"fontSize":"1rem","lineHeight":"1.25rem","letterSpacing":"-0.02em","fontWeight":"$weight",""" +
                    """"fontStyle":"normal","fontFamilyRef":"fontFamily.body"}]""",
            ),
            ThemeTokenPlatform.ANDROID to json(
                """[{"textSize":16,"lineHeight":20,"letterSpacing":-0.02,"fontWeight":$weight,""" +
                    """"fontStyle":"normal","fontFamilyRef":"fontFamily.body"}]""",
            ),
            ThemeTokenPlatform.IOS to json(
                """[{"size":16,"lineHeight":20,"kerning":-0.02,"weight":"$iosWeight",""" +
                    """"style":"normal","fontFamilyRef":"fontFamily.body"}]""",
            ),
        )
    }.toMutableMap()

    private fun json(value: String): JsonElement = Json.parseToJsonElement(value)

    private fun <T> success(result: DsResult<T>): T = assertIs<DsResult.Success<T>>(result).value

    private fun failure(result: DsResult<*>): DsFailure = assertIs<DsResult.Failure>(result).error

    private fun invalid(result: DsResult<*>): DsFailure.InvalidRequest =
        assertIs<DsFailure.InvalidRequest>(failure(result))

    private fun context(role: String, project: String = FakeTypographyStyleRepository.PROJECT) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", project, role),
        "correlation-1",
    )

    private companion object {
        val SCREENS = listOf("screen-l", "screen-m", "screen-s")
        val VARIANTS = listOf("normal", "medium", "bold")
        val WEIGHTS = mapOf("normal" to 400, "medium" to 500, "bold" to 600)
    }
}
