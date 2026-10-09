package com.dsbuilder.ds.app

import java.security.MessageDigest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FlywayBaselineContractTest {
    @Test
    fun `owned baseline contains the accepted schema contracts`() {
        val bytes = requireNotNull(javaClass.getResourceAsStream("/db/migration/V1__db_service_baseline.sql"))
            .use { it.readBytes() }
        val actual = bytes.decodeToString()

        assertEquals("b54adff3873aebd4605ab78e19245217d40f8116970ab78cb64cc0f309277e73", bytes.sha256())
        assertTrue(actual.contains("CREATE OR REPLACE FUNCTION \"state_sets_canonicalize\""))
        assertTrue(actual.contains("CREATE TRIGGER"))
        assertTrue(actual.contains("CREATE TABLE \"design_systems\""))
        assertTrue(actual.contains("ADD COLUMN \"edit_revision\" integer DEFAULT 0 NOT NULL"))
        assertTrue(actual.contains("tenants_design_system_id_name_ci_unique"))
    }

    private fun ByteArray.sha256(): String = MessageDigest.getInstance("SHA-256")
        .digest(this)
        .joinToString("") { byte -> "%02x".format(byte) }
}
