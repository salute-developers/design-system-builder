package com.dsbuilder.documentation.app

import kotlin.test.Test
import kotlin.test.assertTrue

class PublicationCleanupConfigurationContractTest {
    private val configuration by lazy {
        requireNotNull(javaClass.getResource("/application.yaml")).readText()
    }

    @Test
    fun `cleanup is disabled with a twenty four hour grace period by default`() {
        assertTrue(configuration.contains("enabled: \"\$DOCUMENTATION_CLEANUP_ENABLED:false\""))
        assertTrue(configuration.contains("graceSeconds: \"\$DOCUMENTATION_CLEANUP_GRACE_SECONDS:86400\""))
        assertTrue(configuration.contains("pollingMs: \"\$DOCUMENTATION_CLEANUP_POLLING_MS:5000\""))
        assertTrue(configuration.contains("leaseSeconds: \"\$DOCUMENTATION_CLEANUP_LEASE_SECONDS:60\""))
        assertTrue(configuration.contains("retryInitialSeconds: \"\$DOCUMENTATION_CLEANUP_RETRY_INITIAL_SECONDS:30\""))
        assertTrue(configuration.contains("retryMaxSeconds: \"\$DOCUMENTATION_CLEANUP_RETRY_MAX_SECONDS:3600\""))
    }
}
