package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.feature.components.application.ComponentConfigDto
import com.dsbuilder.frontend.feature.components.application.ComponentConfigProjection
import com.dsbuilder.frontend.feature.components.application.ComponentConfigProjector
import com.dsbuilder.frontend.feature.components.application.ConfigPackageDto
import com.dsbuilder.frontend.feature.components.application.ConfiguredComponentDto
import com.dsbuilder.frontend.feature.components.application.PropertyDto
import com.dsbuilder.frontend.feature.components.application.TargetDto
import com.dsbuilder.frontend.feature.components.application.TargetPropertyDto
import com.dsbuilder.frontend.feature.components.application.VariationDto
import com.dsbuilder.frontend.feature.components.application.VariationValueDto
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class ComponentConfigProjectorTest {
    private val packageDto = ConfigPackageDto(
        meta = JsonObject(emptyMap()),
        components = listOf(
            ConfiguredComponentDto(
                componentName = "button",
                styleName = "basic",
                config = ComponentConfigDto(
                    variations = listOf(
                        VariationDto(
                            id = "size",
                            values = listOf(
                                VariationValueDto("large"),
                                VariationValueDto(
                                    name = "small",
                                    targets = listOf(
                                        TargetDto(listOf(TargetPropertyDto("view", JsonPrimitive("accent")))),
                                    ),
                                    properties = mapOf(
                                        "shape" to PropertyDto("shape", value = JsonPrimitive("round.m")),
                                        "literal" to PropertyDto("string", value = JsonPrimitive("not-a-token")),
                                    ),
                                ),
                            ),
                        ),
                        VariationDto("view", values = listOf(VariationValueDto("accent"))),
                    ),
                ),
            ),
        ),
    )

    @Test
    fun selectedValuesRespectCrossAxisTargetAndTokenCatalog() {
        val result = ComponentConfigProjector.project(
            packageDto,
            mapOf("size" to "small", "view" to "accent"),
            setOf("round.m"),
        )

        val projected = assertIs<ComponentConfigProjection.Success>(result).value
        val values = projected.components.single().config.variations.first().values
        assertEquals(listOf("small"), values.map { it.name })
        assertEquals(setOf("shape"), values.single().properties.keys)
    }

    @Test
    fun mismatchedTargetIsRejected() {
        val result = ComponentConfigProjector.project(packageDto, mapOf("size" to "small", "view" to "default"))

        assertIs<ComponentConfigProjection.InvalidSelection>(result)
    }
}
