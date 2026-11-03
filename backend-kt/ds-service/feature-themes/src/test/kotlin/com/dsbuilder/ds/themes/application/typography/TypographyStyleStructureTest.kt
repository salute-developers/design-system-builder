package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.ImmediateTransactions
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleNaming
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Создание, переименование и удаление стиля типографии: девять токенов, значения, ссылки компонентов, права. */
class TypographyStyleStructureTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()
    private val tenantA = UUID.randomUUID()
    private val tenantB = UUID.randomUUID()
    private val ids = listOf(BODY_M, BODY_L).flatMap(TypographyStyleNaming::names).associate { it to UUID.randomUUID() }
    private val repository = FakeTypographyStyleRepository(
        designSystemId = UUID.randomUUID(),
        tenants = setOf(tenantA, tenantB),
        initialDefinitions = ids.entries.associate { (name, id) ->
            id to (name.toString() to ThemeTokenType.TYPOGRAPHY)
        },
        values = mutableMapOf(tenantA to values(), tenantB to values()),
        families = listOf(TypographyFamily("body", "SB Sans Text"), TypographyFamily("caption", "SB Sans Caption")),
    )
    private val keys = mutableListOf<String>()
    private val uniqueKeys = object : UniqueKeyLockRepository {
        override suspend fun lock(designSystemId: UUID, entityType: String, normalizedKey: String) {
            keys += normalizedKey
        }
    }
    private val create = CreateTypographyStyleUseCase(policy, transactions, repository, uniqueKeys)
    private val rename = RenameTypographyStyleUseCase(policy, transactions, repository, repository, uniqueKeys)
    private val delete = DeleteTypographyStyleUseCase(policy, transactions, repository, repository)
    private val renameGroup = RenameTypographyGroupUseCase(policy, transactions, repository, repository, uniqueKeys)
    private val deleteGroup = DeleteTypographyGroupUseCase(policy, transactions, repository, repository)

    @Test
    fun `новый размер группы — девять токенов со значениями ближайшего размера во всех темах`() = runBlocking {
        val created = success(create.execute(context("maintainer"), tenantA, TypographyStyleKey("body", "xl")))

        assertEquals(9, created.tokenIds.size)
        // Девять имён токенов и три переменные пакета — по одной на начертание.
        assertEquals(12, keys.size)
        val bold = TypographyTokenName.parse("screen-l.body.xl.bold")!!
        val boldId = repository.definitions.entries.single { it.value.first == bold.toString() }.key
        // Ближайший размер к `xl` — `l`: значение того же экрана и начертания.
        val source = ids.getValue(bold.copy(style = BODY_L))
        listOf(tenantA, tenantB).forEach { tenant ->
            assertEquals(
                repository.values.getValue(tenant).getValue(source),
                repository.values.getValue(tenant)[boldId],
            )
        }
        assertTrue(boldId in created.tokenIds)
        assertEquals(listOf("screen-l", "screen-m", "screen-s"), created.screens.map { it.screen.wireValue }.sorted())
        assertTrue(created.screens.all { screen -> screen.styles.single().key == TypographyStyleKey("body", "xl") })
        assertTrue(repository.createdFamilies.all { it == null })
    }

    @Test
    fun `своя группа появляется с первым стилем и берёт своё семейство`() = runBlocking {
        val created = success(create.execute(context("maintainer"), tenantA, TypographyStyleKey("caption", "promo-1")))

        assertEquals(9, created.tokenIds.size)
        assertTrue(repository.definitions.values.any { it.first == "screen-s.caption.promo-1.bold" })
        assertTrue(repository.createdFamilies.all { it == "caption" })
        repository.createdFamilies.clear()
        success(create.execute(context("maintainer"), tenantA, TypographyStyleKey("note", "m")))
        assertTrue(repository.createdFamilies.all { it == null })
    }

    @Test
    fun `отказы создания`() = runBlocking {
        suspend fun code(style: TypographyStyleKey, role: String = "maintainer") =
            when (val error = failure(create.execute(context(role), tenantA, style))) {
                is DsFailure.InvalidRequest -> error.code
                is DsFailure.Conflict -> error.code
                else -> error.toString()
            }
        assertEquals("TOKEN_NAME_CONFLICT", code(BODY_M))
        assertEquals("INVALID_TOKEN_NAME", code(TypographyStyleKey("dspl", "m")))
        assertEquals("INVALID_TOKEN_NAME", code(TypographyStyleKey("caption2", "m")))
        assertEquals("INVALID_TOKEN_NAME", code(TypographyStyleKey("body", "x_l")))
        assertEquals("INVALID_TOKEN_NAME", code(TypographyStyleKey("body", "-xl")))
        // Те же переменные пакета: группа header опускается в имени, начертание bold дописывается через дефис.
        assertEquals("TOKEN_NAME_CONFLICT", code(TypographyStyleKey("header", "body-m")))
        assertEquals("TOKEN_NAME_CONFLICT", code(TypographyStyleKey("body", "m-bold")))
        assertEquals("TOKEN_NAME_CONFLICT", code(TypographyStyleKey("bod", "y-m")))
        assertEquals(DsFailure.Forbidden.toString(), code(TypographyStyleKey("body", "xs"), "viewer"))
        assertEquals(18, repository.definitions.size)
    }

    @Test
    fun `переименование меняет размер девяти токенов и привязывает текстовые ссылки к screen-s`() = runBlocking<Unit> {
        val row = UUID.randomUUID()
        repository.textRows = mapOf("body.m.normal" to setOf(row))
        val anchor = ids.getValue(TypographyTokenName.parse("screen-s.body.m.normal")!!)

        val renamed = success(rename.execute(context("editor"), tenantA, ids.values.first(), "medium"))

        assertEquals(9, renamed.tokenIds.size)
        assertEquals("screen-s.body.medium.normal", repository.definitions.getValue(anchor).first)
        assertEquals(setOf(row), repository.bound[anchor])
        assertEquals(
            "TOKEN_NAME_CONFLICT",
            (failure(rename.execute(context("editor"), tenantA, anchor, "l")) as DsFailure.Conflict).code,
        )
        assertIs<DsFailure.InvalidRequest>(failure(rename.execute(context("editor"), tenantA, anchor, "M L")))
    }

    @Test
    fun `ссылка с экраном привязывается к токену своего экрана`() = runBlocking<Unit> {
        val row = UUID.randomUUID()
        repository.textRows = mapOf("screen-l.body.m.bold" to setOf(row))
        val anchor = ids.getValue(TypographyTokenName.parse("screen-l.body.m.bold")!!)

        success(rename.execute(context("editor"), tenantA, anchor, "promo"))

        assertEquals(setOf(row), repository.bound[anchor])
        assertEquals("screen-l.body.promo.bold", repository.definitions.getValue(anchor).first)
    }

    @Test
    fun `своя группа переименовывается и удаляется целиком, системная — нет`() = runBlocking<Unit> {
        success(create.execute(context("maintainer"), tenantA, TypographyStyleKey("caption", "m")))
        success(create.execute(context("maintainer"), tenantA, TypographyStyleKey("caption", "s")))
        val row = UUID.randomUUID()
        repository.textRows = mapOf("caption.s.medium" to setOf(row))

        val renamed = success(renameGroup.execute(context("editor"), tenantA, "caption", "note"))

        assertEquals(18, renamed.tokenIds.size)
        assertTrue(repository.definitions.values.none { it.first.contains(".caption.") })
        val anchor = repository.definitions.entries.single { it.value.first == "screen-s.note.s.medium" }.key
        assertEquals(setOf(row), repository.bound[anchor])
        assertEquals(
            "TOKEN_NAME_CONFLICT",
            (failure(renameGroup.execute(context("editor"), tenantA, "note", "body")) as DsFailure.Conflict).code,
        )
        assertEquals(
            "SYSTEM_TYPOGRAPHY_GROUP",
            (failure(renameGroup.execute(context("editor"), tenantA, "body", "copy")) as DsFailure.InvalidRequest).code,
        )
        assertEquals(DsFailure.NotFound, failure(renameGroup.execute(context("editor"), tenantA, "caption", "x")))

        assertEquals(DsFailure.Forbidden, failure(deleteGroup.execute(context("editor"), tenantA, "note")))
        assertEquals(18, success(deleteGroup.execute(context("maintainer"), tenantA, "note")).tokenIds.size)
        assertTrue(repository.definitions.values.none { it.first.contains(".note.") })
        assertIs<DsFailure.InvalidRequest>(failure(deleteGroup.execute(context("maintainer"), tenantA, "text")))
    }

    @Test
    fun `удаление снимает девять токенов, привязывает ссылки и требует права удаления`() = runBlocking {
        val row = UUID.randomUUID()
        repository.textRows = mapOf("body.l.bold" to setOf(row))
        val token = ids.getValue(TypographyTokenName.parse("screen-m.body.l.medium")!!)

        assertEquals(DsFailure.Forbidden, failure(delete.execute(context("editor"), tenantA, token)))
        val removed = success(delete.execute(context("maintainer"), tenantA, token))

        assertEquals(9, removed.tokenIds.size)
        assertTrue(repository.definitions.values.none { it.first.contains(".body.l.") })
        assertEquals(setOf(row), repository.bound[ids.getValue(TypographyTokenName.parse("screen-s.body.l.bold")!!)])
        assertEquals(DsFailure.NotFound, failure(delete.execute(context("maintainer"), tenantA, token)))
    }

    private fun values(): MutableMap<UUID, Map<ThemeTokenPlatform, JsonElement>> = ids.entries.associate { (name, id) ->
        id to mapOf<ThemeTokenPlatform, JsonElement>(ThemeTokenPlatform.WEB to JsonPrimitive("$name"))
    }.toMutableMap()

    private fun <T> success(result: DsResult<T>): T = assertIs<DsResult.Success<T>>(result).value

    private fun failure(result: DsResult<*>): DsFailure = assertIs<DsResult.Failure>(result).error

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", FakeTypographyStyleRepository.PROJECT, role),
        "correlation-1",
    )

    private companion object {
        val BODY_M = TypographyStyleKey("body", "m")
        val BODY_L = TypographyStyleKey("body", "l")
    }
}
