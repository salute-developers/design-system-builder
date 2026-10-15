package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.ImmediateTransactions
import com.dsbuilder.ds.themes.application.colortokens.FakeColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.MoveColorToken
import com.dsbuilder.ds.themes.application.colortokens.MoveColorTokenUseCase
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import kotlinx.coroutines.runBlocking
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Use case групп токенов и переноса токена: права, ревизии, порядок, имена и отсутствие частичных изменений. */
class TokenGroupUseCaseTest {
    private val policy = DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded()))
    private val transactions = ImmediateTransactions()
    private val current = UUID.fromString("00000000-0000-4000-8000-000000000001")
    private val other = UUID.fromString("00000000-0000-4000-8000-000000000002")
    private val tokens = FakeColorTokenRepository(tenantIds = listOf(current, other))
    private val groups = FakeTokenGroupRepository(tokens.designSystemId)
    private val create = CreateTokenGroupUseCase(policy, transactions, tokens, groups)
    private val update = UpdateTokenGroupUseCase(policy, transactions, tokens, groups)
    private val delete = DeleteTokenGroupUseCase(policy, transactions, tokens, groups)
    private val move = MoveColorTokenUseCase(policy, transactions, tokens, groups)
    private val list = ListTokenGroupsUseCase(policy, transactions, groups)

    private val text = groups.add("Text & Icons", code = "text")
    private val surface = groups.add("Surfaces", code = "surface")
    private val accent = groups.add("Accent", text.id)
    private val status = groups.add("Status", text.id)

    @Test
    fun `создание группы даёт код из названия и увеличивает ревизии всех тем`() = runBlocking {
        val command = CreateTokenGroup(0, TokenGroupKind.COLOR, null, " Brand ", 0)
        val result = success(create.execute(editor(), current, command))

        assertEquals("brand", result.value.code)
        assertEquals("Brand", result.value.label)
        assertEquals(listOf("Brand", "Text & Icons", "Surfaces"), groups.labels(null))
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
        assertEquals(1, result.editRevision)
    }

    @Test
    fun `подгруппа создаётся без кода в конце группы`() = runBlocking {
        val command = CreateTokenGroup(0, TokenGroupKind.COLOR, text.id, "General", null)
        val result = success(create.execute(editor(), current, command))

        assertNull(result.value.code)
        assertEquals(2, result.value.position)
        assertEquals(listOf("Accent", "Status", "General"), groups.labels(text.id))
    }

    @Test
    fun `третий уровень, пустое и занятое название, кириллица без латиницы отклоняются`() = runBlocking {
        fun command(parent: UUID?, label: String) = CreateTokenGroup(0, TokenGroupKind.COLOR, parent, label, null)

        assertEquals(INVALID_TOKEN_GROUP, code(create.execute(editor(), current, command(accent.id, "Deep"))))
        assertEquals(INVALID_TOKEN_GROUP, code(create.execute(editor(), current, command(null, " "))))
        assertEquals(INVALID_TOKEN_GROUP, code(create.execute(editor(), current, command(null, "Бренд"))))
        val conflict =
            assertIs<DsFailure.Conflict>(failure(create.execute(editor(), current, command(text.id, "accent"))))
        assertEquals(TOKEN_GROUP_CONFLICT, conflict.code)
        assertEquals(DsFailure.NotFound, failure(create.execute(editor(), current, command(UUID.randomUUID(), "X"))))
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `устаревшая ревизия и Viewer отклоняются`() = runBlocking {
        val stale = CreateTokenGroup(5, TokenGroupKind.COLOR, null, "Brand", null)
        assertIs<DsFailure.Conflict>(failure(create.execute(editor(), current, stale)))
        val viewerCommand = CreateTokenGroup(0, TokenGroupKind.COLOR, null, "Brand", null)
        val forbidden = create.execute(context("viewer"), current, viewerCommand)
        assertEquals(DsFailure.Forbidden, failure(forbidden))
        assertEquals(listOf("Text & Icons", "Surfaces"), groups.labels(null))
    }

    @Test
    fun `переименование и перестановка не меняют код и имена токенов`() = runBlocking {
        val token = tokens.define("text.default.accent", groupId = accent.id)

        val result = success(update.execute(editor(), current, text.id, UpdateTokenGroup(0, "Text", null, 1)))

        assertEquals("text", result.value.code)
        assertEquals(listOf("Surfaces", "Text"), groups.labels(null))
        assertEquals("text.default.accent", tokens.definitions.single { it.id == token }.name)
    }

    @Test
    fun `перенос подгруппы в группу с другим кодом переименовывает токены с прежними идентификаторами`() = runBlocking {
        val base = tokens.define("text.default.accent", groupId = accent.id)
        val hover = tokens.define("text.on-dark.accent-hover", groupId = accent.id)

        success(update.execute(editor(), current, accent.id, UpdateTokenGroup(0, null, surface.id, 0)))

        assertEquals(surface.id, groups.get(accent.id).parentId)
        assertEquals(listOf("Status"), groups.labels(text.id))
        assertEquals(0, groups.get(status.id).position)
        assertEquals("surface.default.accent", tokens.definitions.single { it.id == base }.name)
        assertEquals("surface.on-dark.accent-hover", tokens.definitions.single { it.id == hover }.name)
        assertEquals("onDarkSurfaceAccentHover", tokens.definitions.single { it.id == hover }.displayName)
    }

    @Test
    fun `перенос подгруппы с занятым именем не меняет данные`() = runBlocking {
        tokens.define("text.default.accent", groupId = accent.id)
        tokens.define("surface.default.accent")

        val result = update.execute(editor(), current, accent.id, UpdateTokenGroup(0, null, surface.id, null))

        assertEquals("TOKEN_NAME_CONFLICT", assertIs<DsFailure.Conflict>(failure(result)).code)
        assertEquals(text.id, groups.get(accent.id).parentId)
        assertTrue(tokens.definitions.any { it.name == "text.default.accent" })
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `группу нельзя сделать подгруппой`() = runBlocking {
        val result = update.execute(editor(), current, surface.id, UpdateTokenGroup(0, null, text.id, null))
        assertEquals(INVALID_TOKEN_GROUP, code(result))
    }

    @Test
    fun `удаление группы удаляет подгруппы и токены, Editor получает 403`() = runBlocking {
        tokens.define("text.default.accent", groupId = accent.id)
        tokens.define("text.default.primary", groupId = text.id)
        val kept = tokens.define("surface.default.primary", groupId = surface.id)

        assertEquals(DsFailure.Forbidden, failure(delete.execute(editor(), current, text.id, 0)))
        assertEquals(1, success(delete.execute(context("maintainer"), current, text.id, 0)))

        assertEquals(listOf("Surfaces"), groups.labels(null))
        assertEquals(0, groups.get(surface.id).position)
        assertTrue(groups.groups.none { it.parentId == text.id })
        assertEquals(listOf(kept), tokens.definitions.map { it.id })
    }

    @Test
    fun `перенос токена в группу с другим кодом и переименование сохраняют идентификаторы`() = runBlocking {
        val base = tokens.define("text.default.accent", groupId = accent.id, position = 0)
        val dark = tokens.define("text.on-dark.accent-hover", groupId = accent.id, position = 0)
        val neighbour = tokens.define("text.default.primary", groupId = accent.id, position = 1)
        val target = tokens.define("surface.default.primary", groupId = surface.id, position = 0)

        val result = success(move.execute(editor(), current, base, MoveColorToken(0, surface.id, 0, "brand")))

        assertEquals("surface", result.value.family.group)
        assertEquals("brand", result.value.family.name)
        assertEquals(setOf("surface.default.brand", "surface.on-dark.brand-hover"), result.value.members.keys)
        assertEquals(setOf(base, dark), result.value.members.values.toSet())
        assertEquals("surfaceBrand", tokens.named("surface.default.brand").displayName)
        assertTrue(
            listOf(base, dark).all { id ->
                tokens.definitions.single { it.id == id }.let { it.groupId == surface.id && it.position == 0 }
            },
        )
        assertEquals(1, tokens.definitions.single { it.id == target }.position)
        assertEquals(0, tokens.definitions.single { it.id == neighbour }.position)
        assertEquals(mapOf(current to 1, other to 1), tokens.revisions)
    }

    @Test
    fun `перенос между подгруппами одной группы не меняет имена`() = runBlocking {
        val base = tokens.define("text.default.accent", groupId = accent.id)

        success(move.execute(editor(), current, base, MoveColorToken(0, status.id, 0, null)))

        assertEquals("text.default.accent", tokens.definitions.single { it.id == base }.name)
        assertEquals(status.id, tokens.definitions.single { it.id == base }.groupId)
    }

    @Test
    fun `перенос отклоняет занятое имя, состояние в имени и контекст не той группы`() = runBlocking {
        val base = tokens.define("text.on-dark.accent", groupId = accent.id)
        tokens.define("text.default.accent", groupId = accent.id)
        tokens.define("text.default.primary", groupId = accent.id)
        val background = groups.add("BG", code = "background")

        val taken = move.execute(editor(), current, base, MoveColorToken(0, accent.id, 0, "primary"))
        assertEquals("TOKEN_NAME_CONFLICT", assertIs<DsFailure.Conflict>(failure(taken)).code)
        val withState = move.execute(editor(), current, base, MoveColorToken(0, accent.id, 0, "brand-hover"))
        assertEquals("INVALID_TOKEN_NAME", code(withState))
        val wrongContext = move.execute(editor(), current, base, MoveColorToken(0, background.id, 0, null))
        assertEquals(INVALID_TOKEN_GROUP, code(wrongContext))
        val missingGroup = move.execute(editor(), current, base, MoveColorToken(0, UUID.randomUUID(), 0, null))
        assertEquals(DsFailure.NotFound, failure(missingGroup))
        assertTrue(tokens.definitions.any { it.name == "text.on-dark.accent" })
        assertEquals(mapOf(current to 0, other to 0), tokens.revisions)
    }

    @Test
    fun `список групп чужой дизайн-системы — 404`() = runBlocking {
        assertEquals(4, success(list.execute(editor(), tokens.designSystemId, TokenGroupKind.COLOR)).size)
        assertEquals(DsFailure.NotFound, failure(list.execute(editor(), UUID.randomUUID(), TokenGroupKind.COLOR)))
    }

    private fun editor() = context("editor")

    private fun context(role: String) = DsRequestContext(
        ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", role),
        "correlation-1",
    )

    private fun <T> success(result: DsResult<T>): T = assertIs<DsResult.Success<T>>(result).value

    private fun failure(result: DsResult<*>): DsFailure = assertIs<DsResult.Failure>(result).error

    private fun code(result: DsResult<*>): String = assertIs<DsFailure.InvalidRequest>(failure(result)).code
}
