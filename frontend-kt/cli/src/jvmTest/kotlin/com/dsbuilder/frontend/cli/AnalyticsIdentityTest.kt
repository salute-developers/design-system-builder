package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.auth.CredentialStoreFileSystem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class AnalyticsIdentityTest {
    @Test fun parallelProcessesModesAndNewVersionsKeepOneIdentity() = runBlocking {
        val root = Files.createTempDirectory("dsbuilder-analytics-").toFile()
        val fs = object : CredentialStoreFileSystem by JvmCredentialStoreFileSystem {
            override fun homeDirectory(): String = root.path
        }
        try {
            val ids = (1..16).map {
                async(Dispatchers.Default) {
                    CliMetricaIdentityStore(fs, JvmCredentialStoreLock).getOrCreateInstallationId()
                }
            }.awaitAll()
            assertEquals(1, ids.toSet().size)
            assertTrue(ids.first().toLong() > 0)
            assertEquals(ids.first(), CliMetricaIdentityStore(fs, JvmCredentialStoreLock).getOrCreateInstallationId())
            val state = root.resolve(".dsbuilder/analytics/installation-id")
            assertEquals("1:${ids.first()}", state.readText())
            state.writeText("corrupt")
            assertFailsWith<IllegalArgumentException> {
                CliMetricaIdentityStore(fs, JvmCredentialStoreLock).getOrCreateInstallationId()
            }
            assertEquals("corrupt", state.readText())
        } finally { root.deleteRecursively() }
    }
}
