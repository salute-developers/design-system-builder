package com.dsbuilder.documentation.processing.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals

class PublicationLockKeyTest {
    @Test
    fun `lock key is unambiguous and compatible with PostgreSQL text`() {
        val key = publicationLockKey("project:1", "design-system", "1.0.0", "compose")

        assertFalse(key.contains('\u0000'))
        assertNotEquals(
            publicationLockKey("ab", "c", "version", "platform"),
            publicationLockKey("a", "bc", "version", "platform"),
        )
    }

    @Test
    fun `every publication identity component contributes to lock key`() {
        val keys = setOf(
            publicationLockKey("project-a", "design-system", "1.0.0", "compose"),
            publicationLockKey("project-b", "design-system", "1.0.0", "compose"),
            publicationLockKey("project-a", "other-design-system", "1.0.0", "compose"),
            publicationLockKey("project-a", "design-system", "2.0.0", "compose"),
            publicationLockKey("project-a", "design-system", "1.0.0", "web"),
        )

        assertEquals(5, keys.size)
    }
}
