package com.dsbuilder.ds.components.domain

import java.util.UUID

/** Вычисляет свойства выбранных значений осей оформления с учётом порядка осей. */
object ComponentPropertyResolver {
    /** Причина отклонения выбранного набора значений. */
    enum class SelectionError { UNKNOWN_VALUE, DUPLICATE_AXIS }

    /** Результат разрешения выбранных значений. */
    sealed interface Result {
        /** Итоговые значения свойств. */
        data class Success(
            /** Итоговые значения. */ val values: List<EditorPropertyValue>,
        ) : Result

        /** Некорректный набор значений. */
        data class Failure(
            /** Причина отказа. */ val error: SelectionError,
        ) : Result
    }

    /** Разрешает базу, одиночные значения и применимые сочетания для выбранных осей. */
    fun resolve(model: AppearanceEditorModel, selectedValueIds: List<UUID>): Result {
        val valueAxes = model.axes.flatMap { axis -> axis.values.map { it.id to axis } }.toMap()
        if (selectedValueIds.any { it !in valueAxes }) return Result.Failure(SelectionError.UNKNOWN_VALUE)
        val selectedAxes = selectedValueIds.map { valueAxes.getValue(it).id }
        if (selectedAxes.size != selectedAxes.toSet().size) return Result.Failure(SelectionError.DUPLICATE_AXIS)

        val selectedStyles = model.axes.flatMap { axis ->
            axis.values.filter { it.id in selectedValueIds }.map { it.styleId to axis.position }
        }.toMap()
        val winners = model.propertyValues.asSequence()
            .filter { value -> value.styleIds.all(selectedStyles::containsKey) }
            .filter { value -> value.kind == EditorValueKind.INVARIANT || value.styleIds.isNotEmpty() }
            .groupBy { it.propertyId to it.stateSetId }
            .values.map { candidates ->
                candidates.maxWith(
                    compareBy<EditorPropertyValue> { value ->
                        value.styleIds.maxOfOrNull { selectedStyles.getValue(it) } ?: Int.MIN_VALUE
                    }.thenBy { it.styleIds.size }.thenComparator { left, right ->
                        val leftPositions = left.styleIds.map(selectedStyles::getValue).sortedDescending()
                        val rightPositions = right.styleIds.map(selectedStyles::getValue).sortedDescending()
                        val firstDifference = leftPositions.zip(rightPositions).firstOrNull { it.first != it.second }
                        when {
                            firstDifference != null -> firstDifference.first.compareTo(firstDifference.second)
                            else -> left.position.compareTo(right.position)
                        }
                    },
                )
            }
            .sortedWith(compareBy({ it.propertyName }, { it.states.joinToString() }))
        return Result.Success(winners)
    }
}
