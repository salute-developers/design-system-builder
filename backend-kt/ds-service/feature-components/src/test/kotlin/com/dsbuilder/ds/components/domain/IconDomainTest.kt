@file:Suppress("ktlint:standard:max-line-length")

package com.dsbuilder.ds.components.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** Имена иконок, начертание, ключ старого формата и идентификатор загрузки. */
class IconDomainTest {
    @Test
    fun `style follows the ending of the name only`() {
        assertEquals(IconStyle.OUTLINE, IconNames.styleOf("AddOutline"))
        assertEquals(IconStyle.OUTLINE_BOLD, IconNames.styleOf("AddOutlineBold"))
        assertEquals(IconStyle.FILL, IconNames.styleOf("AddFill"))
        assertEquals(IconStyle.OUTLINE, IconNames.styleOf("ChevronLeftOutline"))
        assertEquals(IconStyle.OUTLINE, IconNames.styleOf("FillColorOutline"))
        assertEquals(IconStyle.NONE, IconNames.styleOf("Fillet"))
        assertEquals(IconStyle.NONE, IconNames.styleOf("OutlineAdd"))
    }

    @Test
    fun `legacy key is the lowercase words joined by dots`() {
        assertEquals("disclosure.down.fill", IconNames.legacyKeyOf("DisclosureDownFill"))
        assertEquals("info.circle.outline", IconNames.legacyKeyOf("InfoCircleOutline"))
        assertEquals("dots.horizontal.outline", IconNames.legacyKeyOf("DotsHorizontalOutline"))
        assertEquals("chevron.left.outline", IconNames.legacyKeyOf("ChevronLeftOutline"))
        assertEquals("ai.outline", IconNames.legacyKeyOf("AIOutline"))
    }

    @Test
    fun `value of the stored format splits into key and size after the last dot`() {
        assertEquals("disclosure.down.fill" to IconSize.S16, LegacyIconValue.parse("disclosure.down.fill.16"))
        assertEquals("chevron.left" to IconSize.S24, LegacyIconValue.parse("chevron.left.24"))
        assertNull(LegacyIconValue.parse("disclosure.down.fill"))
        assertNull(LegacyIconValue.parse("disclosure.down.fill.20"))
        assertNull(LegacyIconValue.parse(".16"))
        assertEquals("add.outline.24", LegacyIconValue.format("add.outline", IconSize.S24))
    }

    @Test
    fun `names are validated strictly`() {
        assertNotNull(IconNames.parse("AddOutline"))
        assertNotNull(IconNames.parse("Pressure2_5Outline"))
        assertNull(IconNames.parse("addOutline"))
        assertNull(IconNames.parse("Add-Outline"))
        assertNull(IconNames.parse("Add/../Outline"))
        assertNull(IconNames.parse("A" + "b".repeat(64)))
    }

    @Test
    fun `a key without style also resolves to its outline variant`() {
        assertEquals(listOf("close", "close.outline"), LegacyIconValue.candidates("close"))
        assertEquals(listOf("chevron.left", "chevron.left.outline"), LegacyIconValue.candidates("chevron.left"))
    }

    private fun entry(name: String, category: String? = null, aliases: List<String> = emptyList()) =
        IconEntry(name, IconNames.legacyKeyOf(name), IconNames.styleOf(name), setOf(IconSize.S24), category, aliases)

    private fun hashed(entry: IconEntry, svg: String = "<svg/>"): IconEntry =
        entry.copy(contentHash = IconHashing.entryHash(entry, listOf(IconAsset(entry.name, IconSize.S24, svg))))

    @Test
    fun `load id is stable and ignores the order of icons and aliases`() {
        val a = hashed(entry("AddOutline", "Actions", listOf("add", "new")))
        val b = hashed(entry("AddFill"))
        val first = IconHashing.loadId(listOf(a, b))
        val second = IconHashing.loadId(listOf(b, hashed(entry("AddOutline", "Actions", listOf("new", "add")))))
        assertEquals(first, second)
        assertEquals(12, first.value.length)
    }

    @Test
    fun `changing only the category, aliases or svg changes the load id`() {
        val base = IconHashing.loadId(listOf(hashed(entry("AddOutline", "Actions", listOf("add")))))
        assertNotEquals(base, IconHashing.loadId(listOf(hashed(entry("AddOutline", "Other", listOf("add"))))))
        assertNotEquals(base, IconHashing.loadId(listOf(hashed(entry("AddOutline", "Actions", listOf("new"))))))
        assertNotEquals(
            base,
            IconHashing.loadId(listOf(hashed(entry("AddOutline", "Actions", listOf("add")), "<svg><g/></svg>"))),
        )
    }
}
