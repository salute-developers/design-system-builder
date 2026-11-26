package com.dsbuilder.frontend.core.network

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ReadBoundaryTest {
    @Test
    fun `published continuation uses UUID and draft stays live`() {
        val id = "550e8400-e29b-41d4-a716-446655440000"
        assertEquals(
            "?versionId=$id",
            ReadBoundary.parse("""{"designSystemId":"ds","version":"1.0.0","versionId":"$id"}""")?.query(),
        )
        assertEquals(
            "?version=draft",
            ReadBoundary.parse("""{"designSystemId":"ds","version":"draft","draftId":"$id"}""")?.query(),
        )
        assertNull(ReadBoundary.parse("""{"designSystemId":"ds","version":"1.0.0","draftId":"$id"}"""))
        assertNull(ReadBoundary.parse("""{"designSystemId":"ds","version":"draft","versionId":"$id"}"""))
        assertNull(ReadBoundary.parse("invalid"))
    }

    @Test
    fun `response validation rejects missing ambiguous or changed publication boundaries`() {
        val id = "550e8400-e29b-41d4-a716-446655440001"
        val publication = """{"designSystemId":"ds","version":"1.0.0","versionId":"$id"}"""
        assertTrue(ReadBoundary.validates(publication, "ds", required = true))
        assertFalse(ReadBoundary.validates(null, "ds", required = true))
        assertFalse(ReadBoundary.validates(publication, "other"))
        assertFalse(ReadBoundary.validates(publication, "ds", version = "2.0.0"))
        assertFalse(ReadBoundary.validates(publication, "ds", pinnedRaw = "invalid"))
        assertFalse(ReadBoundary.validates(publication, "ds", headersValid = false))
        assertTrue(ReadBoundary.validates(null, "ds"))
        val draft = """{"designSystemId":"ds","version":"draft","draftId":"before"}"""
        val nextDraft = """{"designSystemId":"ds","version":"draft","draftId":"after"}"""
        assertTrue(ReadBoundary.validates(nextDraft, "ds", pinnedRaw = draft))
        assertFalse(ReadBoundary.validates(publication, "ds", pinnedRaw = draft))
    }
}
