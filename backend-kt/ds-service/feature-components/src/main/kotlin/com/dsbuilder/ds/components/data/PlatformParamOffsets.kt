package com.dsbuilder.ds.components.data

import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Числовые смещения значений, записанные поправками платформенных параметров.
 *
 * Значения из web-сидов и legacy-сохранения держат смещение не в колонке `adjustment` строки,
 * а в поправках по платформам. Без этого источника выгрузка теряла бы смещение.
 *
 * Берутся только числа, не совпадающие со значением строки: нечисловые поправки — платформенные
 * строки или копии значения от старого импорта. При разных смещениях по платформам приоритет
 * у web, дальше xml, compose, ios.
 *
 * TODO: удалить вместе с поддержкой поправок платформенных параметров (`*_platform_param_adjustments`),
 * когда смещение будет храниться только в колонке `adjustment`.
 */
internal class PlatformParamOffsets {
    /** Читает смещения значений одной конфигурации. */
    fun load(appearanceId: UUID): Offsets = Offsets(
        invariant = pick(invariantCandidates(appearanceId)),
        variation = pick(variationCandidates(appearanceId)),
    )

    private fun variationCandidates(appearanceId: UUID): List<Candidate> = VariationPlatformParamAdjustmentsTable
        .join(
            PropertyPlatformParamsTable,
            JoinType.INNER,
            VariationPlatformParamAdjustmentsTable.platformParamId,
            PropertyPlatformParamsTable.id,
        )
        .join(
            VariationPropertyValuesTable,
            JoinType.INNER,
            VariationPlatformParamAdjustmentsTable.vpvId,
            VariationPropertyValuesTable.id,
        )
        .join(ComponentTokensTable, JoinType.LEFT, VariationPropertyValuesTable.tokenId, ComponentTokensTable.id)
        .selectAll()
        .where {
            (VariationPropertyValuesTable.appearanceId eq appearanceId) and
                VariationPlatformParamAdjustmentsTable.value.isNotNull()
        }
        .map {
            Candidate(
                it[VariationPropertyValuesTable.id],
                it[VariationPropertyValuesTable.value] ?: it.getOrNull(ComponentTokensTable.name),
                it[PropertyPlatformParamsTable.platform].wireValue,
                it[VariationPlatformParamAdjustmentsTable.value].orEmpty(),
            )
        }

    private fun invariantCandidates(appearanceId: UUID): List<Candidate> = InvariantPlatformParamAdjustmentsTable
        .join(
            PropertyPlatformParamsTable,
            JoinType.INNER,
            InvariantPlatformParamAdjustmentsTable.platformParamId,
            PropertyPlatformParamsTable.id,
        )
        .join(
            InvariantPropertyValuesTable,
            JoinType.INNER,
            InvariantPlatformParamAdjustmentsTable.ipvId,
            InvariantPropertyValuesTable.id,
        )
        .join(ComponentTokensTable, JoinType.LEFT, InvariantPropertyValuesTable.tokenId, ComponentTokensTable.id)
        .selectAll()
        .where {
            (InvariantPropertyValuesTable.appearanceId eq appearanceId) and
                InvariantPlatformParamAdjustmentsTable.value.isNotNull()
        }
        .map {
            Candidate(
                it[InvariantPropertyValuesTable.id],
                it[InvariantPropertyValuesTable.value] ?: it.getOrNull(ComponentTokensTable.name),
                it[PropertyPlatformParamsTable.platform].wireValue,
                it[InvariantPlatformParamAdjustmentsTable.value].orEmpty(),
            )
        }

    /** Смещения одной конфигурации по идентификаторам строк значений. */
    data class Offsets(val invariant: Map<UUID, String>, val variation: Map<UUID, String>) {
        companion object {
            val EMPTY = Offsets(emptyMap(), emptyMap())
        }
    }

    /** Поправка платформенного параметра как кандидат в смещение строки значения. */
    data class Candidate(val rowId: UUID, val rowValue: String?, val platform: String, val offset: String)

    companion object {
        private val PLATFORM_PRIORITY = mapOf("web" to 0, "xml" to 1, "compose" to 2, "ios" to 3)
        private const val UNKNOWN_PLATFORM_PRIORITY = 9
        private val DECIMAL_NUMBER = Regex("""[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?""")

        /** Число в десятичной записи; пустые и нечисловые поправки смещением не считаются. */
        fun isNumeric(value: String): Boolean = DECIMAL_NUMBER.matches(value)

        /** Выбирает смещение каждой строки: числовое, не равное значению строки, с приоритетом платформ. */
        fun pick(candidates: List<Candidate>): Map<UUID, String> = candidates
            .filter { isNumeric(it.offset) && it.offset != it.rowValue }
            .groupBy(Candidate::rowId)
            .mapValues { (_, rows) ->
                rows.minBy { PLATFORM_PRIORITY[it.platform] ?: UNKNOWN_PLATFORM_PRIORITY }.offset
            }
    }
}
