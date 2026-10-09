package com.dsbuilder.ds.tokens.data

import com.dsbuilder.ds.tokens.domain.TokenType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.security.MessageDigest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class TokenDefinitionsResourceTest {
    @Test
    fun `canonical token definitions are complete and valid`() {
        val bytes = requireNotNull(javaClass.getResourceAsStream("/token-definitions.json"))
            .use { it.readBytes() }
        val definitions = Json.parseToJsonElement(bytes.decodeToString()).jsonArray

        assertEquals("f1a4fd131f7977d98f51797f3f1aed6357fca9b00533a1ccda7e697b5d33f6a6", bytes.sha256())
        assertEquals(2_469, definitions.size)
        val names = definitions.map { definition ->
            val value = definition.jsonObject
            val name = value.getValue("name").jsonPrimitive.content
            assertTrue(name.isNotBlank())
            assertTrue(value.getValue("displayName").jsonPrimitive.content.isNotBlank())
            assertTrue(value.getValue("description").jsonPrimitive.content.isNotBlank())
            assertNotNull(TokenType.fromWire(value.getValue("type").jsonPrimitive.content))
            value.getValue("enabled").jsonPrimitive.boolean
            name
        }

        assertEquals(1_335, names.distinct().size)
    }

    private fun ByteArray.sha256(): String = MessageDigest.getInstance("SHA-256")
        .digest(this)
        .joinToString("") { byte -> "%02x".format(byte) }
}
