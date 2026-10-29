package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.data.InvalidModelReadQueryException
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull

class TokenGroupReadPageTest {
    private val designSystemId = UUID.randomUUID()
    private val first = group("First", 0)
    private val second = group("Second", 1)
    private val childB = group("B", 1, first.id)
    private val childA = group("A", 0, first.id)
    private val groups = listOf(second, childB, first, childA)

    @Test
    fun `pages combine to the full tree order across parent boundary`() {
        val expected = listOf(first.id, childA.id, childB.id, second.id)
        assertEquals(
            expected,
            pageTokenGroups(groups, ModelReadQuery(), designSystemId, TokenGroupKind.COLOR, null)
                .items.map(TokenGroup::id),
        )
        val seen = mutableListOf<UUID>()
        var cursor: String? = null
        do {
            val page = pageTokenGroups(
                groups,
                ModelReadQuery(limit = 1, cursor = cursor, scope = "project/version"),
                designSystemId,
                TokenGroupKind.COLOR,
                null,
            )
            seen += page.items.map(TokenGroup::id)
            cursor = page.page?.nextCursor
        } while (cursor != null)
        assertEquals(expected, seen)
    }

    @Test
    fun `parent filter pages siblings by position and rejects foreign cursor`() {
        val firstPage = pageTokenGroups(
            groups,
            ModelReadQuery(limit = 1, scope = "project/version"),
            designSystemId,
            TokenGroupKind.COLOR,
            first.id,
        )
        assertEquals(listOf(childA.id), firstPage.items.map(TokenGroup::id))
        val cursor = assertNotNull(firstPage.page?.nextCursor)
        val next = pageTokenGroups(
            groups,
            ModelReadQuery(limit = 1, cursor = cursor, scope = "project/version"),
            designSystemId,
            TokenGroupKind.COLOR,
            first.id,
        )
        assertEquals(listOf(childB.id), next.items.map(TokenGroup::id))
        assertFailsWith<InvalidModelReadQueryException> {
            pageTokenGroups(
                groups,
                ModelReadQuery(limit = 1, cursor = cursor, scope = "other-version"),
                designSystemId,
                TokenGroupKind.COLOR,
                first.id,
            )
        }
    }

    @Test
    fun `equal positions use stable ids and cursor survives deletion of previous item`() {
        val a = group("A", 0).copy(id = UUID.fromString("00000000-0000-0000-0000-000000000001"))
        val b = group("B", 0).copy(id = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff"))
        val expected = listOf(a, b)
        val firstPage = pageTokenGroups(
            listOf(b, a),
            ModelReadQuery(limit = 1, scope = "project/version"),
            designSystemId,
            TokenGroupKind.COLOR,
            null,
        )
        assertEquals(expected.first().id, firstPage.items.single().id)
        val cursor = assertNotNull(firstPage.page?.nextCursor)
        val secondPage = pageTokenGroups(
            listOf(expected.last()),
            ModelReadQuery(limit = 1, cursor = cursor, scope = "project/version"),
            designSystemId,
            TokenGroupKind.COLOR,
            null,
        )
        assertEquals(expected.last().id, secondPage.items.single().id)
    }

    private fun group(label: String, position: Int, parentId: UUID? = null) = TokenGroup(
        UUID.randomUUID(),
        designSystemId,
        TokenGroupKind.COLOR,
        parentId,
        if (parentId == null) label.lowercase() else null,
        label,
        position,
    )
}
