package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.themes.application.typography.TypographyUsageRepository
import com.dsbuilder.ds.themes.domain.typography.ComponentPropertyReference
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.statements.StatementType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/**
 * Значения свойств компонентов дизайн-системы, похожие на ссылку на стиль типографии: текст значения вариаций и
 * инвариантов или имя токена типографии из `token_id`. Значения, стили компонентов и токены разрешаются по
 * последней предметной редакции на границе транзакции — выбранной опубликованной версии или активного черновика —
 * по тому же правилу, что `ResolvedRevisionTable` модуля компонентов.
 */
class ExposedTypographyUsageRepository : TypographyUsageRepository {
    private val variationValues =
        resolved("variation_property_values", "variation_property_value", ", entity.style_id", VALUE_FIELDS)
    private val invariantValues =
        resolved("invariant_property_values", "invariant_property_value", ", entity.component_id", VALUE_FIELDS)
    private val componentStyles = resolved("styles", "style", ", entity.variation_id", "latest.name")
    private val typographyTokens = resolved("tokens", "token", "", "latest.name, latest.type")

    override suspend fun references(designSystemId: UUID): List<ComponentPropertyReference> {
        val sql = """
            WITH variation_values AS ($variationValues),
                 invariant_values AS ($invariantValues),
                 component_styles AS ($componentStyles),
                 typography_tokens AS ($typographyTokens)
            SELECT c.name AS component,
                   CASE WHEN v.token_id IS NULL THEN v.value ELSE t.name END AS reference
              FROM variation_values v
              JOIN component_styles st ON st.id = v.style_id
              JOIN variations vr ON vr.id = st.variation_id
              JOIN components c ON c.id = vr.component_id
              LEFT JOIN typography_tokens t ON t.id = v.token_id AND t.type = 'typography'
             WHERE v.design_system_id = ?
               AND $REFERENCE_FILTER
            UNION ALL
            SELECT c.name AS component,
                   CASE WHEN v.token_id IS NULL THEN v.value ELSE t.name END AS reference
              FROM invariant_values v
              JOIN components c ON c.id = v.component_id
              LEFT JOIN typography_tokens t ON t.id = v.token_id AND t.type = 'typography'
             WHERE v.design_system_id = ?
               AND $REFERENCE_FILTER
        """.trimIndent()
        val id = UUIDColumnType() to designSystemId
        return TransactionManager.current().exec(
            sql,
            listOf(id, id, id, id, id, id),
            explicitStatementType = StatementType.SELECT,
        ) { rows ->
            buildList {
                while (rows.next()) {
                    val reference = rows.getString("reference") ?: continue
                    add(ComponentPropertyReference(rows.getString("component"), reference))
                }
            }
        }.orEmpty()
    }

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

    private companion object {
        /** Предварительный отбор текста значений; точный разбор — в домене. */
        const val REFERENCE = """^(screen-[sml]\.)?[a-z]+\.[a-z0-9]+\.(normal|medium|bold)$"""

        /**
         * Значение — ссылка на стиль: текст по правилу [REFERENCE] или `token_id` токена типографии. Ссылки на токены
         * других типов (цвета, формы) отсекаются до соединения с компонентами, а не после разбора.
         */
        const val REFERENCE_FILTER = "((v.token_id IS NULL AND v.value ~ '$REFERENCE') " +
            "OR v.token_id IN (SELECT id FROM typography_tokens WHERE type = 'typography'))"

        /** Поля редакции значения свойства, которые нужны запросу использования. */
        const val VALUE_FIELDS = "latest.token_id, latest.value"
    }
}
