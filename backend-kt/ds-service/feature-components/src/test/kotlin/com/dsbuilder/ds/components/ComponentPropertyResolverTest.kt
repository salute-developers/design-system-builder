package com.dsbuilder.ds.components

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.components.domain.ComponentPropertyResolver
import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.EditorValueKind
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class ComponentPropertyResolverTest {
    private val appearanceId = UUID.randomUUID()
    private val size = axis(0)
    private val view = axis(1)
    private val sizeValue = size.values.single()
    private val viewValue = view.values.single()
    private val height = UUID.randomUUID()
    private val background = UUID.randomUUID()
    private val stateSet = UUID.randomUUID()

    @Test
    fun selectedAxesInheritBaseAndEarlierProperties() {
        val model = model(
            property(height, "height", EditorValueKind.INVARIANT, emptyList(), "24"),
            property(height, "height", EditorValueKind.VARIATION, listOf(sizeValue.styleId), "32"),
            property(background, "background", EditorValueKind.VARIATION, listOf(viewValue.styleId), "blue"),
        )

        val result = assertIs<ComponentPropertyResolver.Result.Success>(
            ComponentPropertyResolver.resolve(model, listOf(sizeValue.id, viewValue.id)),
        )
        assertEquals(
            mapOf("background" to "blue", "height" to "32"),
            result.values.associate { it.propertyName to it.value },
        )
    }

    @Test
    fun laterAxisAndCombinationWinOnTheirPosition() {
        val model = model(
            property(background, "background", EditorValueKind.VARIATION, listOf(sizeValue.styleId), "red"),
            property(background, "background", EditorValueKind.VARIATION, listOf(viewValue.styleId), "blue"),
            property(
                background,
                "background",
                EditorValueKind.COMBINATION,
                listOf(sizeValue.styleId, viewValue.styleId),
                "green",
            ),
        )

        val sizeOnly = assertIs<ComponentPropertyResolver.Result.Success>(
            ComponentPropertyResolver.resolve(model, listOf(sizeValue.id)),
        )
        assertEquals("red", sizeOnly.values.single().value)
        val both = assertIs<ComponentPropertyResolver.Result.Success>(
            ComponentPropertyResolver.resolve(model, listOf(sizeValue.id, viewValue.id)),
        )
        assertEquals("green", both.values.single().value)
    }

    @Test
    fun rejectsUnknownValueAndDuplicateAxis() {
        val model = model()
        assertEquals(
            ComponentPropertyResolver.SelectionError.UNKNOWN_VALUE,
            assertIs<ComponentPropertyResolver.Result.Failure>(
                ComponentPropertyResolver.resolve(model, listOf(UUID.randomUUID())),
            ).error,
        )
        assertEquals(
            ComponentPropertyResolver.SelectionError.DUPLICATE_AXIS,
            assertIs<ComponentPropertyResolver.Result.Failure>(
                ComponentPropertyResolver.resolve(model, listOf(sizeValue.id, sizeValue.id)),
            ).error,
        )
    }

    private fun model(vararg values: EditorPropertyValue) = AppearanceEditorModel(
        Appearance(appearanceId, UUID.randomUUID(), UUID.randomUUID(), "default", true, Instant.EPOCH, Instant.EPOCH),
        null,
        listOf(size, view),
        values.toList(),
    )

    private fun axis(position: Int): EditorAxis = EditorAxis(
        UUID.randomUUID(), UUID.randomUUID(), "axis-$position", null, position,
        false, false, false, null, null, null,
        listOf(EditorAxisValue(UUID.randomUUID(), UUID.randomUUID(), "value", null, 0, null, null)),
    )

    private fun property(
        propertyId: UUID,
        name: String,
        kind: EditorValueKind,
        styles: List<UUID>,
        value: String,
    ) = EditorPropertyValue(
        UUID.randomUUID(), kind, propertyId, name, styles, emptyList(), stateSet,
        null, value, null, null, 0, null, null,
    )
}
