package com.dsbuilder.settings.data

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class Pbkdf2TokenSecretManagerTest {
    @Test fun `secrets have independent salt and invalid secrets fail`() {
        val manager = Pbkdf2TokenSecretManager(iterations = 1000)
        val secret = manager.generate()
        val hash = manager.hash(secret)
        assertNotEquals(secret, manager.generate())
        assertNotEquals(hash, manager.hash(secret))
        assertTrue(manager.verify(secret, hash))
        assertFalse(manager.verify("wrong", hash))
        assertFalse(manager.verify(secret, "malformed"))
    }
}
