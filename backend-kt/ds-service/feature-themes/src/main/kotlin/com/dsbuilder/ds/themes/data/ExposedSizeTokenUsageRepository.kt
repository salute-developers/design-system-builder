package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenUsageRepository
import com.dsbuilder.ds.themes.domain.sizetokens.AdjustedUsage
import com.dsbuilder.ds.themes.domain.sizetokens.ComponentUsage
import com.dsbuilder.ds.themes.domain.sizetokens.RadiusOffset
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.math.RoundingMode
import java.util.UUID

/**
 * Использование токенов размеров в конфигурациях компонентов дизайн-системы: значения свойств вариаций, инвариантов
 * и комбинаций стилей со ссылкой на токен через `token_id` или текстом, равным имени токена, и числовые поправки
 * платформенных параметров этих значений. Значения, поправки, конфигурации и токены разрешаются по последней
 * предметной редакции на границе транзакции — выбранной опубликованной версии или активного черновика — по тому же
 * правилу, что `ResolvedRevisionTable` модуля компонентов.
 */
class ExposedSizeTokenUsageRepository : SizeTokenUsageRepository {
    private val variationValues =
        resolved("variation_property_values", "variation_property_value", ", entity.appearance_id", VALUE_FIELDS)
    private val invariantValues = resolved(
        "invariant_property_values",
        "invariant_property_value",
        ", entity.appearance_id, entity.component_id",
        VALUE_FIELDS,
    )
    private val combinationValues =
        resolved("style_combinations", "style_combination", ", entity.appearance_id", VALUE_FIELDS)
    private val appearances = resolved("appearances", "appearance", ", entity.component_id", "latest.name")
    private val sizeTokens = resolved("tokens", "token", "", "latest.name, latest.type")

    /** Действующие связи компонентов с дизайн-системой: удаление компонента из ДС оставляет его конфигурации. */
    private val componentLinks =
        resolved("design_system_components", "design_system_component", ", entity.component_id", "latest.deleted")
    private val variationAdjustments = resolved(
        "variation_platform_param_adjustments",
        "variation_platform_param_adjustment",
        ", entity.vpv_id AS value_id, entity.platform_param_id",
        "latest.value",
    )
    private val invariantAdjustments = resolved(
        "invariant_platform_param_adjustments",
        "invariant_platform_param_adjustment",
        ", entity.ipv_id AS value_id, entity.platform_param_id",
        "latest.value",
    )

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
        if (references.isEmpty()) return emptyMap()
        val params = paramOffsets(designSystemId, references)
        return references.mapNotNull { reference ->
            val own = reference.adjustment?.let(::offset)?.let { offset ->
                RadiusOffset(offset, AdjustedUsage(reference.component, reference.platform, null))
            }
            (own ?: params[reference.source to reference.rowId]?.let { RadiusOffset(it.offset, it.usage(reference)) })
                ?.let { reference.token to it }
        }.groupBy({ it.first }, { it.second })
    }

    /**
     * Действующие значения свойств компонентов [designSystemId], которые ссылаются на токены [tokens]. Учитываются
     * только компоненты с действующей связью с дизайн-системой на той же границе версии.
     */
    private fun references(designSystemId: UUID, tokens: Map<UUID, String>): List<Reference> {
        if (tokens.isEmpty()) return emptyList()
        val names = tokens.values.toSet()
        val sql = """
            WITH variation_values AS ($variationValues),
                 invariant_values AS ($invariantValues),
                 combination_values AS ($combinationValues),
                 live_appearances AS ($appearances),
                 size_tokens AS ($sizeTokens),
                 live_links AS ($componentLinks)
            SELECT 'variation' AS source, v.id AS row_id, v.token_id, v.value, v.adjustment,
                   c.name AS component, c.platform::text AS platform
              FROM variation_values v
              JOIN live_appearances a ON a.id = v.appearance_id
              JOIN components c ON c.id = a.component_id
             WHERE $REFERENCE_FILTER
               AND EXISTS (SELECT 1 FROM live_links l WHERE l.component_id = c.id)
            UNION ALL
            SELECT 'invariant' AS source, v.id AS row_id, v.token_id, v.value, v.adjustment,
                   c.name AS component, c.platform::text AS platform
              FROM invariant_values v
              JOIN live_appearances a ON a.id = v.appearance_id
              JOIN components c ON c.id = v.component_id
             WHERE $REFERENCE_FILTER
               AND EXISTS (SELECT 1 FROM live_links l WHERE l.component_id = c.id)
            UNION ALL
            SELECT 'combination' AS source, v.id AS row_id, v.token_id, v.value, v.adjustment,
                   c.name AS component, c.platform::text AS platform
              FROM combination_values v
              JOIN live_appearances a ON a.id = v.appearance_id
              JOIN components c ON c.id = a.component_id
             WHERE $REFERENCE_FILTER
               AND EXISTS (SELECT 1 FROM live_links l WHERE l.component_id = c.id)
        """.trimIndent()
        return query(sql, designSystemId, CTE_COUNT) { rows ->
            val tokenId = rows.getString("token_id")?.let(UUID::fromString)
            val value = rows.getString("value")
            // Ссылка через `token_id` на другой токен не считается ссылкой на токен раздела, текст — считается.
            val token = tokenId?.let(tokens::get) ?: value?.takeIf { it in names } ?: return@query null
            Reference(
                rowId = UUID.fromString(rows.getString("row_id")),
                source = rows.getString("source"),
                token = token,
                rowValue = value ?: token,
                component = rows.getString("component"),
                platform = rows.getString("platform"),
                adjustment = rows.getString("adjustment"),
            )
        }
    }

    /**
     * Числовая поправка платформенного параметра у каждой строки [references], как в выгрузке конфигурации:
     * поправка, равная значению строки, смещением не считается; при разных поправках приоритет у web, затем xml,
     * compose, ios.
     */
    private fun paramOffsets(designSystemId: UUID, references: List<Reference>): Map<Pair<String, UUID>, ParamOffset> {
        val byRow = references.filter { it.source != COMBINATION }.associateBy { it.source to it.rowId }
        if (byRow.isEmpty()) return emptyMap()
        val sql = """
            WITH variation_adjustments AS ($variationAdjustments),
                 invariant_adjustments AS ($invariantAdjustments)
            SELECT 'variation' AS source, a.value_id, a.value, p.platform::text AS platform, p.name
              FROM variation_adjustments a
              JOIN property_platform_params p ON p.id = a.platform_param_id
             WHERE a.value IS NOT NULL
            UNION ALL
            SELECT 'invariant' AS source, a.value_id, a.value, p.platform::text AS platform, p.name
              FROM invariant_adjustments a
              JOIN property_platform_params p ON p.id = a.platform_param_id
             WHERE a.value IS NOT NULL
        """.trimIndent()
        return query(sql, designSystemId, 2) { rows ->
            val key = rows.getString("source") to UUID.fromString(rows.getString("value_id"))
            val reference = byRow[key] ?: return@query null
            val number = rows.getString("value")?.takeIf { it != reference.rowValue }?.let(::offset)
                ?: return@query null
            key to ParamOffset(number, rows.getString("platform"), rows.getString("name"))
        }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, offsets) -> offsets.minBy { priority(it.platform) } }
    }

    /** Приоритет поправки по платформе: web, затем xml, compose, ios; неизвестная платформа — последней. */
    private fun priority(platform: String): Int =
        PLATFORM_PRIORITY.indexOf(platform).takeIf { it >= 0 } ?: PLATFORM_PRIORITY.size

    private fun <T : Any> query(
        sql: String,
        designSystemId: UUID,
        parameters: Int,
        read: (java.sql.ResultSet) -> T?,
    ): List<T> = TransactionManager.current().exec(
        sql,
        List(parameters) { UUIDColumnType() to designSystemId },
        explicitStatementType = StatementType.SELECT,
    ) { rows ->
        buildList { while (rows.next()) read(rows)?.let(::add) }
    }.orEmpty()

    /**
     * Устойчивые строки [table] дизайн-системы: поля [stable] устойчивой строки и [fields] её последней не удалённой
     * редакции `<revision>_revisions` на границе `ds.version_id` или активного черновика.
     */
    private fun resolved(table: String, revision: String, stable: String, fields: String): String = """
        SELECT entity.id, entity.design_system_id$stable, $fields
          FROM $table entity
          JOIN design_system_versions boundary
            ON boundary.design_system_id = entity.design_system_id
           AND boundary.id = COALESCE(
                NULLIF(current_setting('ds.version_id', true), '')::uuid,
                (SELECT active.id FROM design_system_versions active
                  WHERE active.design_system_id = entity.design_system_id AND active.status = 'draft')
           )
           AND boundary.status IN ('draft', 'published')
          JOIN LATERAL (
                SELECT candidate.*
                  FROM ${revision}_revisions candidate
                 WHERE candidate.${revision}_id = entity.id
                   AND candidate.version_sequence_number <= boundary.sequence_number
                 ORDER BY candidate.version_sequence_number DESC
                 LIMIT 1
          ) latest ON NOT latest.deleted
         WHERE entity.design_system_id = ?
    """.trimIndent()

    /** Число в десятичной записи, округлённое до целых px; пустые и нечисловые смещения не считаются. */
    private fun offset(value: String): Int? = value.trim().takeIf(DECIMAL::matches)?.toBigDecimal()
        ?.setScale(0, RoundingMode.HALF_UP)
        ?.toInt()

    /** Строка значения свойства компонента со ссылкой на токен. */
    private data class Reference(
        val rowId: UUID,
        val source: String,
        val token: String,
        val rowValue: String,
        val component: String,
        val platform: String,
        val adjustment: String?,
    )

    /** Поправка платформенного параметра строки значения. */
    private data class ParamOffset(val offset: Int, val platform: String, val parameter: String) {
        fun usage(reference: Reference) = AdjustedUsage(reference.component, platform, parameter)
    }

    private companion object {
        const val COMBINATION = "combination"

        /** Число подзапросов `resolved` в запросе ссылок: у каждого свой параметр дизайн-системы. */
        const val CTE_COUNT = 6

        /** Поля редакции значения свойства, которые нужны запросу использования. */
        const val VALUE_FIELDS = "latest.token_id, latest.value, latest.adjustment"

        /**
         * Предварительный отбор: `token_id` токена размеров или текст с префиксом имени раздела; точное совпадение
         * имени проверяется после чтения.
         */
        const val REFERENCE_FILTER = "(v.token_id IN (SELECT id FROM size_tokens " +
            "WHERE type IN ('shape', 'spacing', 'shadow')) OR v.value ~ '^(round|spacing|down|up)\\.')"

        val PLATFORM_PRIORITY = listOf("web", "xml", "compose", "ios")
        val DECIMAL = Regex("""[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?""")
    }
}
