package com.dsbuilder.ds.app

import java.security.MessageDigest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FlywayBaselineContractTest {
    @Test
    fun `owned baseline contains the accepted schema contracts`() {
        val bytes = requireNotNull(javaClass.getResourceAsStream("/db/migration/V1__db_service_baseline.sql"))
            .use { it.readBytes() }
        val actual = bytes.decodeToString()

        assertEquals("61c787e3e031bc1457acbc41f559583158fc07d98ba5b247681cb6d7c2f4f890", bytes.sha256())
        assertTrue(actual.contains("CREATE OR REPLACE FUNCTION \"state_sets_canonicalize\""))
        assertTrue(actual.contains("CREATE TRIGGER"))
        assertTrue(actual.contains("CREATE TABLE \"design_systems\""))
        assertFalse(actual.contains("ADD COLUMN \"edit_revision\" integer DEFAULT 0 NOT NULL"))
        assertFalse(actual.contains("tenants_design_system_id_name_ci_unique"))
    }

    @Test
    fun `tenant upgrade and token backfill form one migration`() {
        val upgrade = requireNotNull(
            javaClass.getResource("/db/migration/V2__complete_legacy_transition.sql"),
        ).readText()
        assertTrue(upgrade.contains("LOCK TABLE"))
        assertTrue(upgrade.contains("Conflicting normalized tenant names"))
        assertTrue(upgrade.contains("edit_revision"))
        assertTrue(upgrade.contains("tenants_design_system_id_name_ci_unique"))
        val backfill = upgrade.substringAfter("-- Copy values for custom tokens")
        assertEquals(
            "2ec5024c14ecd6834b55bb3f5099287f38a3744143d15071587bf1d399021327",
            ("-- Copy values for custom tokens" + backfill).encodeToByteArray().sha256(),
        )
    }

    private fun ByteArray.sha256(): String = MessageDigest.getInstance("SHA-256")
        .digest(this)
        .joinToString("") { byte -> "%02x".format(byte) }
}
