package com.dsbuilder.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.security.MessageDigest
import kotlin.test.Test
import kotlin.test.assertEquals

class ResourceIntegrityTest {
    @Test
    fun `packaged migrations and seeds retain the original bytes`() {
        val expected = Json.parseToJsonElement(File("contracts/resources.sha256.json").readText()).jsonObject
        for ((path, checksum) in expected) {
            val bytes = requireNotNull(javaClass.classLoader.getResourceAsStream(path)) { path }.use { it.readBytes() }
            val actual = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            assertEquals(checksum.jsonPrimitive.content, actual, path)
        }
    }
}
