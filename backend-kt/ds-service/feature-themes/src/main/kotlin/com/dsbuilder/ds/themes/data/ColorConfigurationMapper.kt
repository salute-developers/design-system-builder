package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.domain.ColorConfiguration
import com.dsbuilder.ds.themes.domain.CustomPalette
import com.dsbuilder.ds.themes.domain.ThemeProfile
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

internal object ColorConfigurationMapper {
    fun fromJson(value: JsonElement): ColorConfiguration {
        val objectValue = value as? JsonObject ?: JsonObject(emptyMap())
        return ColorConfiguration(
            profile = ThemeProfile.fromWire(objectValue.string("profile")),
            customPalette = objectValue.customPalette(),
            grayTone = objectValue.string("grayTone"),
            accentColor = objectValue.string("accentColor"),
            light = objectValue.saturation("light"),
            dark = objectValue.saturation("dark"),
        )
    }

    fun toJson(value: ColorConfiguration): JsonObject = JsonObject(
        buildMap {
            value.profile?.let { put("profile", JsonPrimitive(it.wireValue)) }
            value.customPalette?.let { put("customPalette", it.toJson()) }
            value.grayTone?.let { put("grayTone", JsonPrimitive(it)) }
            value.accentColor?.let { put("accentColor", JsonPrimitive(it)) }
            value.light?.let { put("light", it.toJson()) }
            value.dark?.let { put("dark", it.toJson()) }
        },
    )

    private fun JsonObject.string(name: String): String? = get(name)?.jsonPrimitive?.content

    private fun JsonObject.saturation(name: String): ColorConfiguration.Saturation? = get(name)?.jsonObject?.let {
        ColorConfiguration.Saturation(
            strokeSaturation = it.getValue("strokeSaturation").jsonPrimitive.double,
            fillSaturation = it.getValue("fillSaturation").jsonPrimitive.double,
        )
    }

    private fun JsonObject.customPalette(): CustomPalette? = get("customPalette")?.jsonObject?.let {
        val primary = it.string("primary") ?: return@let null
        val onPrimary = it.string("onPrimary") ?: return@let null
        val background = it.string("background") ?: return@let null
        val text = it.string("text") ?: return@let null
        CustomPalette(primary, onPrimary, background, text)
    }

    private fun CustomPalette.toJson() = JsonObject(
        mapOf(
            "primary" to JsonPrimitive(primary),
            "onPrimary" to JsonPrimitive(onPrimary),
            "background" to JsonPrimitive(background),
            "text" to JsonPrimitive(text),
        ),
    )

    private fun ColorConfiguration.Saturation.toJson() = JsonObject(
        mapOf(
            "strokeSaturation" to JsonPrimitive(strokeSaturation),
            "fillSaturation" to JsonPrimitive(fillSaturation),
        ),
    )
}
