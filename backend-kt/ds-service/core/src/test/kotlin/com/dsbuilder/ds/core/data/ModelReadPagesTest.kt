package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.ModelReadQuery
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class ModelReadPagesTest {
    private val items = (1..8).map { number ->
        "token" to UUID.fromString("00000000-0000-0000-0000-${number.toString().padStart(12, '0')}")
    }

    @Test
    fun `journal continuation does not depend on last row existence or page size`() {
        val read = ModelReadQuery(limit = 2, scope = "project/ds/draft")
        val first = items.modelReadJournalPage(read, { it.first }, { it.second })
        val cursor = assertNotNull(first.page?.nextCursor)
        val second = items.filter { it != first.items.last() }
            .modelReadJournalPage(read.copy(limit = 3, cursor = cursor), { it.first }, { it.second })
        assertEquals(items.subList(2, 5), second.items)
        val end = items.modelReadJournalPage(read.copy(limit = 10, cursor = cursor), { it.first }, { it.second })
        assertEquals(items.drop(2), end.items)
        assertNull(end.page?.nextCursor)
    }

    @Test
    fun `cursor is bound to scope and filters but not limit`() {
        val read = ModelReadQuery(limit = 1, scope = "project/ds/draft", name = "first")
        val cursor = assertNotNull(items.modelReadJournalPage(read, { it.first }, { it.second }).page?.nextCursor)
        listOf(
            read.copy(scope = "other/ds/draft"),
            read.copy(scope = "project/other/draft"),
            read.copy(scope = "project/ds/new-draft"),
            read.copy(name = "other"),
        ).forEach { changed ->
            assertFailsWith<InvalidModelReadQueryException> {
                items.modelReadJournalPage(changed.copy(cursor = cursor), { it.first }, { it.second })
            }
        }
        assertFailsWith<InvalidModelReadQueryException> {
            items.modelReadJournalPage(read.copy(cursor = "not-a-cursor"), { it.first }, { it.second })
        }
        assertEquals(items, items.modelReadJournalPage(ModelReadQuery(), { it.first }, { it.second }).items)
    }
}
