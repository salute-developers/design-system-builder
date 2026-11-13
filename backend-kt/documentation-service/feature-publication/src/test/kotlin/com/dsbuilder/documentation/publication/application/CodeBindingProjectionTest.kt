package com.dsbuilder.documentation.publication.application

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertSame

class CodeBindingProjectionTest {
    private val binding = CodeBindingDto(
        "binding-1",
        "components.avatar",
        "component-style",
        "Avatar",
        "compose",
        Json.parseToJsonElement(
            """{"key":"avatar","coreName":"Avatar","styles":[
                {"key":"avatar","coreName":"Avatar","styleName":"Avatar","props":[{"name":"size","defaultValue":"m"}],
                 "styleApi":{"stylesClassName":"AvatarStyles"},"variations":[
                   {"name":"m","composeReference":"Avatar.M"},{"name":"l","composeReference":"Avatar.L"}]},
                {"key":"avatar","coreName":"Avatar","styleName":"AvatarAlt","variations":[]}
            ]}""",
        ),
    )

    @Test
    fun legacyFullReturnsOriginalPayload() {
        assertSame(binding, CodeBindingProjection.project(binding, "full", emptySet(), emptySet()))
    }

    @Test
    fun summaryKeepsNamesDefaultsAndCountsWithoutStyleApiOrVariations() {
        val projected = CodeBindingProjection.project(binding, "summary", setOf("Avatar"), emptySet())!!
        val payload = projected.platformPayload.jsonObject
        val style = payload.getValue("styles").jsonArray.single().jsonObject
        assertEquals("Avatar", style.getValue("styleName").jsonPrimitive.content)
        assertEquals("2", style.getValue("variationCount").jsonPrimitive.content)
        assertEquals("2", payload.getValue("totalVariationCount").jsonPrimitive.content)
        val defaultValue = style.getValue("props").jsonArray.single().jsonObject.getValue("defaultValue")
        assertEquals("m", defaultValue.jsonPrimitive.content)
        assertFalse("styleApi" in style)
        assertFalse("variations" in style)
    }

    @Test
    fun summaryKeepsDefaultsFromStyleApiParametersWhenPropsAreEmpty() {
        val styleApiOnly = binding.copy(
            platformPayload = Json.parseToJsonElement(
                """{"key":"avatar","coreName":"Avatar","styles":[{
                    "key":"avatar","coreName":"Avatar","styleName":"Avatar",
                    "styleApi":{"stylesClassName":"AvatarStyles","params":[{
                        "name":"size","type":"enum","defaultValue":{"value":"m","codeName":"M"},
                        "values":[{"value":"m","codeName":"M"},{"value":"l","codeName":"L"}]
                    }]},"variations":[]
                }]}""",
            ),
        )

        val projected = CodeBindingProjection.project(styleApiOnly, "summary", emptySet(), emptySet())!!
        val style = projected.platformPayload.jsonObject.getValue("styles").jsonArray.single().jsonObject
        val param = style.getValue("params").jsonArray.single().jsonObject
        assertEquals("size", param.getValue("name").jsonPrimitive.content)
        assertEquals("m", param.getValue("defaultValue").jsonObject.getValue("value").jsonPrimitive.content)
        assertEquals(2, param.getValue("values").jsonArray.size)
        assertFalse("styleApi" in style)
    }

    @Test
    fun variationsFiltersExactNamesAndOmitsStyleApi() {
        val projected = CodeBindingProjection.project(binding, "variations", setOf("Avatar"), setOf("l"))!!
        val style = projected.platformPayload.jsonObject.getValue("styles").jsonArray.single().jsonObject
        val variationName = style.getValue("variations").jsonArray.single().jsonObject.getValue("name")
        assertEquals("l", variationName.jsonPrimitive.content)
        assertFalse("styleApi" in style)
    }

    @Test
    fun tokenBindingNeverInventsComponentVariations() {
        val token = binding.copy(kind = "theme-token")
        assertSame(token, CodeBindingProjection.project(token, "variations", emptySet(), setOf("m")))
    }
}
