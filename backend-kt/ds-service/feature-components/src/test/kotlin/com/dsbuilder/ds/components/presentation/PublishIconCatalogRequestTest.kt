@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.IconSize
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** Разбор тела загрузки каталога иконок. */
class PublishIconCatalogRequestTest {
    private val json = Json { ignoreUnknownKeys = true }

    private fun decode(body: String) = json.decodeFromString<PublishIconCatalogRequest>(body)

    @Test
    fun `a manifest becomes a command with sizes keyed by the pixel size`() {
        val request = decode(
            """{"schemaVersion":1,"source":{"package":"@salutejs/sdds-icons","version":"1.2.3"},
               "icons":[{"name":"AddOutline","category":"Actions","aliases":["add"],"sizes":{"16":"<svg/>","24":"<svg/>"}}]}""",
        )
        val command = request.toCommand(dryRun = true, allowRemovingUsed = false)
        assertEquals("@salutejs/sdds-icons", command.packageName)
        assertEquals("1.2.3", command.packageVersion)
        val icon = command.icons.single()
        assertEquals(setOf(IconSize.S16, IconSize.S24), icon.sizes.keys)
        assertEquals("Actions", icon.category)
    }

    @Test
    fun `an unknown schema version or size key is rejected`() {
        val base = """"source":{"package":"p","version":"1"}"""
        assertFailsWith<IllegalArgumentException> {
            decode("""{"schemaVersion":2,$base,"icons":[]}""").toCommand(true, false)
        }
        val unknownSize = """{"schemaVersion":1,$base,"icons":[{"name":"A","sizes":{"20":"<svg/>"}}]}"""
        assertFailsWith<NoSuchElementException> { decode(unknownSize).toCommand(true, false) }
    }
}
