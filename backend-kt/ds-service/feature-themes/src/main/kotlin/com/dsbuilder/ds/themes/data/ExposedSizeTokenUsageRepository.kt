package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenUsageRepository
import com.dsbuilder.ds.themes.domain.sizetokens.AdjustedUsage
import com.dsbuilder.ds.themes.domain.sizetokens.ComponentUsage
import com.dsbuilder.ds.themes.domain.sizetokens.RadiusOffset
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.math.RoundingMode
import java.util.UUID

/**
 * Использование токенов размеров в конфигурациях компонентов дизайн-системы: значения свойств вариаций, инвариантов
 * и комбинаций стилей со ссылкой на токен через `token_id` или текстом, равным имени токена.
 */
class ExposedSizeTokenUsageRepository : SizeTokenUsageRepository {
    override suspend fun usage(designSystemId: UUID, tokens: Map<UUID, String>): Map<String, List<ComponentUsage>> =
        references(designSystemId, tokens)
            .groupBy(Reference::token)
            .mapValues { (_, rows) ->
                rows.groupingBy(Reference::component).eachCount().map { (component, count) ->
                    ComponentUsage(component, count)
                }
            }

    override suspend fun adjustments(designSystemId: UUID, tokens: Map<UUID, String>): Map<String, List<RadiusOffset>> {
        val references = references(designSystemId, tokens)
        val variationParams = paramOffsets(references.filter { it.source == Source.VARIATION }, variation = true)
        val invariantParams = paramOffsets(references.filter { it.source == Source.INVARIANT }, variation = false)
        return references.mapNotNull { reference ->
            val own = reference.adjustment?.let(::offset)?.let { offset ->
                RadiusOffset(offset, AdjustedUsage(reference.component, reference.platform, null))
            }
            val params = if (reference.source == Source.VARIATION) variationParams else invariantParams
            (own ?: params[reference.rowId]?.let { param -> RadiusOffset(param.offset, param.usage(reference)) })
                ?.let { reference.token to it }
        }.groupBy({ it.first }, { it.second })
    }

    /** Строки значений компонентов [designSystemId], которые ссылаются на токены [tokens]. */
    private fun references(designSystemId: UUID, tokens: Map<UUID, String>): List<Reference> {
        if (tokens.isEmpty()) return emptyList()
        val ids = tokens.keys
        val names = tokens.values.toSet()
        fun resolve(tokenId: UUID?, value: String?): String? =
            tokenId?.let(tokens::get) ?: value?.takeIf { it in names }
        val variations = SizeVariationValuesTable
            .join(SizeAppearancesTable, JoinType.INNER, SizeVariationValuesTable.appearanceId, SizeAppearancesTable.id)
            .join(SizeComponentsTable, JoinType.INNER, SizeAppearancesTable.componentId, SizeComponentsTable.id)
            .selectAll()
            .where {
                (SizeAppearancesTable.designSystemId eq designSystemId) and
                    ((SizeVariationValuesTable.tokenId inList ids) or (SizeVariationValuesTable.value inList names))
            }
            .mapNotNull { row ->
                val token = resolve(row[SizeVariationValuesTable.tokenId], row[SizeVariationValuesTable.value])
                token?.let {
                    Reference(
                        rowId = row[SizeVariationValuesTable.id],
                        source = Source.VARIATION,
                        token = it,
                        rowValue = row[SizeVariationValuesTable.value] ?: it,
                        component = row[SizeComponentsTable.name],
                        platform = row[SizeComponentsTable.platform].wireValue,
                        adjustment = row[SizeVariationValuesTable.adjustment],
                    )
                }
            }
        val invariants = SizeInvariantValuesTable
            .join(SizeComponentsTable, JoinType.INNER, SizeInvariantValuesTable.componentId, SizeComponentsTable.id)
            .selectAll()
            .where {
                (SizeInvariantValuesTable.designSystemId eq designSystemId) and
                    ((SizeInvariantValuesTable.tokenId inList ids) or (SizeInvariantValuesTable.value inList names))
            }
            .mapNotNull { row ->
                val token = resolve(row[SizeInvariantValuesTable.tokenId], row[SizeInvariantValuesTable.value])
                token?.let {
                    Reference(
                        rowId = row[SizeInvariantValuesTable.id],
                        source = Source.INVARIANT,
                        token = it,
                        rowValue = row[SizeInvariantValuesTable.value] ?: it,
                        component = row[SizeComponentsTable.name],
                        platform = row[SizeComponentsTable.platform].wireValue,
                        adjustment = row[SizeInvariantValuesTable.adjustment],
                    )
                }
            }
        return variations + invariants + combinations(designSystemId, ids, names, ::resolve)
    }

    private fun combinations(
        designSystemId: UUID,
        ids: Collection<UUID>,
        names: Collection<String>,
        resolve: (UUID?, String?) -> String?,
    ): List<Reference> = SizeStyleCombinationsTable
        .join(SizeAppearancesTable, JoinType.INNER, SizeStyleCombinationsTable.appearanceId, SizeAppearancesTable.id)
        .join(SizeComponentsTable, JoinType.INNER, SizeAppearancesTable.componentId, SizeComponentsTable.id)
        .selectAll()
        .where {
            (SizeAppearancesTable.designSystemId eq designSystemId) and
                ((SizeStyleCombinationsTable.tokenId inList ids) or (SizeStyleCombinationsTable.value inList names))
        }
        .mapNotNull { row ->
            resolve(row[SizeStyleCombinationsTable.tokenId], row[SizeStyleCombinationsTable.value])?.let {
                Reference(
                    rowId = row[SizeStyleCombinationsTable.id],
                    source = Source.COMBINATION,
                    token = it,
                    rowValue = row[SizeStyleCombinationsTable.value],
                    component = row[SizeComponentsTable.name],
                    platform = row[SizeComponentsTable.platform].wireValue,
                    adjustment = row[SizeStyleCombinationsTable.adjustment],
                )
            }
        }

    /**
     * Числовая поправка платформенного параметра у каждой строки [references], как в выгрузке конфигурации:
     * поправка, равная значению строки, смещением не считается; при разных поправках приоритет у web, затем xml,
     * compose, ios.
     */
    private fun paramOffsets(references: List<Reference>, variation: Boolean): Map<UUID, ParamOffset> {
        if (references.isEmpty()) return emptyMap()
        val byRow = references.associateBy(Reference::rowId)
        val rows = if (variation) {
            SizeVariationAdjustmentsTable
                .join(
                    SizePlatformParamsTable,
                    JoinType.INNER,
                    SizeVariationAdjustmentsTable.platformParamId,
                    SizePlatformParamsTable.id,
                )
                .selectAll()
                .where {
                    (SizeVariationAdjustmentsTable.vpvId inList byRow.keys) and
                        SizeVariationAdjustmentsTable.value.isNotNull()
                }
                .map { row ->
                    Triple(row[SizeVariationAdjustmentsTable.vpvId], row[SizeVariationAdjustmentsTable.value], row)
                }
        } else {
            SizeInvariantAdjustmentsTable
                .join(
                    SizePlatformParamsTable,
                    JoinType.INNER,
                    SizeInvariantAdjustmentsTable.platformParamId,
                    SizePlatformParamsTable.id,
                )
                .selectAll()
                .where {
                    (SizeInvariantAdjustmentsTable.ipvId inList byRow.keys) and
                        SizeInvariantAdjustmentsTable.value.isNotNull()
                }
                .map { row ->
                    Triple(row[SizeInvariantAdjustmentsTable.ipvId], row[SizeInvariantAdjustmentsTable.value], row)
                }
        }
        return rows
            .mapNotNull { (rowId, value, row) ->
                val number = value?.takeIf { it != byRow[rowId]?.rowValue }?.let(::offset)
                number?.let {
                    rowId to ParamOffset(
                        offset = it,
                        platform = row[SizePlatformParamsTable.platform],
                        parameter = row[SizePlatformParamsTable.name],
                    )
                }
            }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, offsets) -> offsets.minBy { it.platform.priority } }
    }

    /** Число в десятичной записи, округлённое до целых px; пустые и нечисловые смещения не считаются. */
    private fun offset(value: String): Int? = value.trim().takeIf(DECIMAL::matches)?.toBigDecimal()
        ?.setScale(0, RoundingMode.HALF_UP)
        ?.toInt()

    /** Откуда строка значения. */
    private enum class Source { VARIATION, INVARIANT, COMBINATION }

    /** Строка значения свойства компонента со ссылкой на токен. */
    private data class Reference(
        val rowId: UUID,
        val source: Source,
        val token: String,
        val rowValue: String,
        val component: String,
        val platform: String,
        val adjustment: String?,
    )

    /** Поправка платформенного параметра строки значения. */
    private data class ParamOffset(val offset: Int, val platform: SizeComponentPlatform, val parameter: String) {
        fun usage(reference: Reference) = AdjustedUsage(reference.component, platform.wireValue, parameter)
    }

    private companion object {
        val DECIMAL = Regex("""[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?""")
    }
}
