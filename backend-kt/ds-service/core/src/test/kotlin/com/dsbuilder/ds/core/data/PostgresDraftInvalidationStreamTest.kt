package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DraftInvalidationScope
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** Проверяет безопасный разбор компактного PostgreSQL-уведомления. */
class PostgresDraftInvalidationStreamTest {
    @Test
    fun `parses committed draft invalidation`() {
        val event = parseDraftInvalidation(
            """{
                "designSystemId":"11111111-1111-1111-1111-111111111111",
                "draftId":"22222222-2222-2222-2222-222222222222",
                "draftRevision":7,
                "actorId":"user-1",
                "clientId":"tab-1",
                "changedAt":"2026-10-15T13:30:00Z",
                "scopes":["theme-tokens","component-configurations"]
            }
            """.trimIndent(),
        )

        assertEquals(7, event?.draftRevision)
        assertEquals("tab-1", event?.clientId)
        assertEquals(
            setOf(DraftInvalidationScope.THEME_TOKENS, DraftInvalidationScope.COMPONENT_CONFIGURATIONS),
            event?.scopes,
        )
    }

    @Test
    fun `accepts absent client and rejects malformed payload`() {
        val event = parseDraftInvalidation(
            """{
                "designSystemId":"11111111-1111-1111-1111-111111111111",
                "draftId":"22222222-2222-2222-2222-222222222222",
                "draftRevision":7,
                "actorId":"system",
                "clientId":null,
                "changedAt":"2026-10-15T13:30:00Z",
                "scopes":["all"]
            }
            """.trimIndent(),
        )

        assertNull(event?.clientId)
        assertEquals(setOf(DraftInvalidationScope.ALL), event?.scopes)
        assertNull(parseDraftInvalidation("not-json"))
    }

    @Test
    fun `falls back to all when payload contains unknown scope`() {
        val event = parseDraftInvalidation(
            """{
                "designSystemId":"11111111-1111-1111-1111-111111111111",
                "draftId":"22222222-2222-2222-2222-222222222222",
                "draftRevision":8,
                "actorId":"system",
                "clientId":null,
                "changedAt":"2026-10-15T13:31:00Z",
                "scopes":["theme-tokens","palette"]
            }
            """.trimIndent(),
        )

        assertEquals(setOf(DraftInvalidationScope.ALL), event?.scopes)
    }
}
