package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Действующие имена осей и значений оформления до замены его объявления при импорте.
 *
 * Импорт сопоставляет оси и значения конфигурации с существующими по действующему имени оформления и
 * переносит отображаемые имена в новое объявление, чтобы замена не теряла переименования редактора.
 */
internal class EffectiveNameSnapshot private constructor(
    private val axes: Map<String, AxisName>,
    private val values: Map<Pair<UUID, String>, ValueName>,
) {
    /** Ось, переименованная в оформлении. */
    class AxisName(val variationId: UUID, val displayName: String?)

    /** Значение оси, переименованное в оформлении. */
    class ValueName(val styleId: UUID, val displayName: String?)

    /** Ось с действующим именем [name] либо `null`. */
    fun axis(name: String): AxisName? = axes[name.trim().lowercase()]

    /** Значение вариации [variationId] с действующим именем [name] либо `null`. */
    fun value(variationId: UUID, name: String): ValueName? = values[variationId to name.trim().lowercase()]

    companion object {
        /** Пустой снимок для нового оформления. */
        val EMPTY = EffectiveNameSnapshot(emptyMap(), emptyMap())

        /** Собирает снимок действующих имён оформления [appearanceId] до его очистки. */
        fun capture(appearanceId: UUID): EffectiveNameSnapshot {
            val axisRows = AppearanceVariationsTable.join(
                VariationsTable,
                JoinType.INNER,
                AppearanceVariationsTable.variationId,
                VariationsTable.id,
            ).selectAll().where { AppearanceVariationsTable.appearanceId eq appearanceId }.toList()
            val axes = axisRows.associate {
                val display = it[AppearanceVariationsTable.displayName]
                AppearanceEditorRules.axisName(display, it[VariationsTable.name]).trim().lowercase() to
                    AxisName(it[AppearanceVariationsTable.variationId], display)
            }
            val values = buildMap {
                axisRows.forEach { axis ->
                    AppearanceVariationValuesTable.join(
                        ComponentStylesTable,
                        JoinType.INNER,
                        AppearanceVariationValuesTable.styleId,
                        ComponentStylesTable.id,
                    ).selectAll()
                        .where {
                            AppearanceVariationValuesTable.appearanceVariationId eq axis[AppearanceVariationsTable.id]
                        }
                        .forEach {
                            val display = it[AppearanceVariationValuesTable.displayName]
                            put(
                                axis[AppearanceVariationsTable.variationId] to
                                    AppearanceEditorRules.axisName(display, it[ComponentStylesTable.name])
                                        .trim().lowercase(),
                                ValueName(it[AppearanceVariationValuesTable.styleId], display),
                            )
                        }
                }
            }
            return EffectiveNameSnapshot(axes, values)
        }
    }
}
